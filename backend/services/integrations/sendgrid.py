"""SendGrid transactional email — API-key integration.

Uses the SendGrid v3 REST API directly via ``httpx`` so the whole call
path stays async. The sync ``sendgrid`` SDK in requirements.txt is only
used by legacy code; new work should go through this plugin.

Credential shape
----------------
Decrypted credentials dict::

    {
        "api_key": "SG.xxxx..."
    }

Optional ``config`` keys::

    from_email       — default sender address (e.g. "noreply@acme.com")
    from_name        — default sender display name
    webhook_secret   — HMAC secret for /webhooks/sendgrid signature check
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from services.integrations import register
from services.integrations.base import BaseIntegration, IntegrationTestResult

logger = logging.getLogger(__name__)

_SENDGRID_BASE = "https://api.sendgrid.com/v3"
_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


@register("sendgrid")
class SendGridIntegration(BaseIntegration):
    provider = "sendgrid"
    display_name = "SendGrid"
    uses_oauth = False

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.credentials.get('api_key', '')}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # BaseIntegration surface
    # ------------------------------------------------------------------

    async def test_connection(self) -> IntegrationTestResult:
        """GET /v3/user/profile — lightweight auth check."""
        api_key = self.credentials.get("api_key")
        if not api_key:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message="Missing 'api_key'. Get it from SendGrid → Settings → API Keys.",
            )

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(
                    f"{_SENDGRID_BASE}/user/profile", headers=self._headers()
                )
        except httpx.HTTPError as exc:
            logger.warning("sendgrid test_connection network error: %s", exc)
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=f"Network error contacting SendGrid: {exc}",
            )

        if resp.status_code == 200:
            data: dict[str, Any] = resp.json() if resp.content else {}
            username = data.get("username") or data.get("email") or "unknown"
            return IntegrationTestResult(
                ok=True,
                provider=self.provider,
                message=f"Connected to SendGrid account: {username}",
                details=data,
            )

        if resp.status_code == 401:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message="SendGrid rejected the API key (401). Re-copy it from the dashboard.",
            )

        return IntegrationTestResult(
            ok=False,
            provider=self.provider,
            message=f"SendGrid returned {resp.status_code}: {resp.text[:200]}",
        )

    async def push_event(
        self,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Send a transactional email.

        ``event_type``:

        * ``"email"`` — ``payload = {"to": "x@y.com", "subject": "...",
          "body_html": "...", "body_text": "..."}``
        """
        if event_type != "email":
            return {"ok": False, "error": f"Unsupported event_type '{event_type}'"}

        api_key = self.credentials.get("api_key")
        if not api_key:
            return {"ok": False, "error": "Missing api_key"}

        from_email = (
            payload.get("from_email")
            or self.config.get("from_email")
        )
        if not from_email:
            return {
                "ok": False,
                "error": "Missing from_email. Set it in config or pass in payload.",
            }

        body: dict[str, Any] = {
            "personalizations": [{"to": [{"email": payload.get("to")}]}],
            "from": {
                "email": from_email,
                **({"name": self.config.get("from_name")} if self.config.get("from_name") else {}),
            },
            "subject": payload.get("subject", ""),
            "content": [],
        }
        if payload.get("body_text"):
            body["content"].append({"type": "text/plain", "value": payload["body_text"]})
        if payload.get("body_html"):
            body["content"].append({"type": "text/html", "value": payload["body_html"]})
        if not body["content"]:
            body["content"].append({"type": "text/plain", "value": ""})

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    f"{_SENDGRID_BASE}/mail/send",
                    json=body,
                    headers=self._headers(),
                )
        except httpx.HTTPError as exc:
            logger.error("sendgrid push_event network error: %s", exc)
            return {"ok": False, "error": f"network: {exc}"}

        if resp.status_code // 100 == 2:
            return {
                "ok": True,
                "message_id": resp.headers.get("X-Message-Id"),
            }

        return {
            "ok": False,
            "status": resp.status_code,
            "error": resp.text[:300],
        }
