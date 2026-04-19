"""Generic SMTP email provider — works with Gmail, SES, Mailgun, Postmark, etc.

Uses stdlib ``smtplib`` run on a thread (``asyncio.to_thread``) so the
call path stays non-blocking without pulling in ``aiosmtplib``. The
``test_connection`` step performs a connect + STARTTLS + LOGIN +
NOOP sequence so we never send an actual probe email.

Credential shape
----------------
Decrypted credentials dict::

    {
        "host": "smtp.sendgrid.net",
        "port": "587",
        "username": "apikey",
        "password": "SG.xxxx..."
    }

Optional ``config`` keys::

    from_email   — default sender
    from_name    — default sender display name
    use_tls      — "true" (default) to issue STARTTLS; "false" for plaintext
    use_ssl      — "true" to use SMTPS on port 465; default "false"
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from typing import Any

from services.integrations import register
from services.integrations.base import BaseIntegration, IntegrationTestResult

logger = logging.getLogger(__name__)

_TIMEOUT_S = 15


def _truthy(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


@register("smtp")
class SmtpIntegration(BaseIntegration):
    provider = "smtp"
    display_name = "SMTP"
    uses_oauth = False

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_required(self, key: str) -> str:
        val = self.credentials.get(key)
        if not val:
            raise ValueError(f"smtp: missing '{key}'")
        return str(val)

    def _port(self) -> int:
        raw = self.credentials.get("port") or "587"
        try:
            return int(str(raw).strip())
        except ValueError:
            return 587

    def _use_tls(self) -> bool:
        return _truthy(self.config.get("use_tls"), default=True)

    def _use_ssl(self) -> bool:
        return _truthy(self.config.get("use_ssl"), default=False)

    def _sync_test(self) -> tuple[bool, str]:
        """Blocking connect + login + NOOP. Runs on a worker thread."""
        host = self._get_required("host")
        port = self._port()
        username = self._get_required("username")
        password = self._get_required("password")

        try:
            if self._use_ssl():
                client = smtplib.SMTP_SSL(host, port, timeout=_TIMEOUT_S)
            else:
                client = smtplib.SMTP(host, port, timeout=_TIMEOUT_S)
            try:
                client.ehlo()
                if self._use_tls() and not self._use_ssl():
                    client.starttls()
                    client.ehlo()
                client.login(username, password)
                client.noop()
            finally:
                try:
                    client.quit()
                except Exception:  # noqa: BLE001
                    pass
        except smtplib.SMTPAuthenticationError as exc:
            return False, f"Authentication failed: {exc.smtp_error.decode(errors='replace') if isinstance(exc.smtp_error, bytes) else exc}"
        except smtplib.SMTPException as exc:
            return False, f"SMTP error: {exc}"
        except OSError as exc:
            return False, f"Connection error: {exc}"
        return True, f"Connected to {host}:{port} as {username}"

    def _sync_send(self, payload: dict[str, Any]) -> tuple[bool, str]:
        """Blocking message send. Runs on a worker thread."""
        host = self._get_required("host")
        port = self._port()
        username = self._get_required("username")
        password = self._get_required("password")

        from_email = payload.get("from_email") or self.config.get("from_email")
        if not from_email:
            return False, "Missing from_email (set in config or payload)"
        to_email = payload.get("to")
        if not to_email:
            return False, "Missing 'to' recipient"

        msg = EmailMessage()
        msg["Subject"] = payload.get("subject", "")
        from_name = self.config.get("from_name")
        msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
        msg["To"] = to_email

        text = payload.get("body_text") or ""
        msg.set_content(text or " ")
        if payload.get("body_html"):
            msg.add_alternative(payload["body_html"], subtype="html")

        try:
            if self._use_ssl():
                client = smtplib.SMTP_SSL(host, port, timeout=_TIMEOUT_S)
            else:
                client = smtplib.SMTP(host, port, timeout=_TIMEOUT_S)
            try:
                client.ehlo()
                if self._use_tls() and not self._use_ssl():
                    client.starttls()
                    client.ehlo()
                client.login(username, password)
                client.send_message(msg)
            finally:
                try:
                    client.quit()
                except Exception:  # noqa: BLE001
                    pass
        except smtplib.SMTPException as exc:
            return False, f"SMTP error: {exc}"
        except OSError as exc:
            return False, f"Connection error: {exc}"
        return True, "Sent"

    # ------------------------------------------------------------------
    # BaseIntegration surface
    # ------------------------------------------------------------------

    async def test_connection(self) -> IntegrationTestResult:
        for key in ("host", "username", "password"):
            if not self.credentials.get(key):
                return IntegrationTestResult(
                    ok=False,
                    provider=self.provider,
                    message=f"Missing '{key}'. Fill in host, port, username and password.",
                )

        try:
            ok, message = await asyncio.to_thread(self._sync_test)
        except Exception as exc:  # noqa: BLE001
            logger.exception("smtp test_connection crashed")
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=f"Unexpected error: {exc}",
            )
        return IntegrationTestResult(ok=ok, provider=self.provider, message=message)

    async def push_event(
        self,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        if event_type != "email":
            return {"ok": False, "error": f"Unsupported event_type '{event_type}'"}
        try:
            ok, message = await asyncio.to_thread(self._sync_send, payload)
        except Exception as exc:  # noqa: BLE001
            logger.exception("smtp push_event crashed")
            return {"ok": False, "error": f"Unexpected error: {exc}"}
        return {"ok": ok, "error": None if ok else message}
