"""WhatsApp Business — direct Meta Cloud API integration (Option B).

This plugin talks straight to the Meta WhatsApp Business Cloud API using a
permanent access token and a phone number ID. It is the lowest-cost path
(you pay Meta directly, no BSP markup) and is the right choice when:

* You have a Meta Business Manager account and are happy to go through
  Meta's review process for your own app, OR
* A customer has already granted you a permanent system-user token via
  Meta's Embedded Signup flow.

For customers who don't want to touch Meta directly, see the companion
:mod:`services.integrations.whatsapp_gupshup` plugin which wraps the
Gupshup BSP (Option D).

Credential shape
----------------
The decrypted credentials dict is expected to contain::

    {
        "access_token": "EAAG...",       # System-user or page token
        "phone_number_id": "15550001234"  # Meta phone number ID
    }

Optional ``config`` keys::

    waba_id     — WhatsApp Business Account ID (used by template endpoints)
    api_version — e.g. "v19.0"; defaults to v19.0
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from services.integrations import register
from services.integrations.base import BaseIntegration, IntegrationTestResult

logger = logging.getLogger(__name__)

_DEFAULT_API_VERSION = "v19.0"
_GRAPH_BASE = "https://graph.facebook.com"
_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


@register("whatsapp")
class WhatsAppCloudIntegration(BaseIntegration):
    """Direct Meta WhatsApp Business Cloud API connector."""

    provider = "whatsapp"
    display_name = "WhatsApp Business (Cloud API)"
    uses_oauth = False  # Permanent token / Embedded Signup result

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _api_version(self) -> str:
        return str(self.config.get("api_version") or _DEFAULT_API_VERSION)

    def _require(self, key: str) -> str:
        val = self.credentials.get(key)
        if not val:
            raise ValueError(f"whatsapp: missing credential '{key}'")
        return str(val)

    def _auth_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._require('access_token')}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # BaseIntegration surface
    # ------------------------------------------------------------------

    async def test_connection(self) -> IntegrationTestResult:
        """GET /{phone_number_id} — verifies the token and phone pair."""
        token = self.credentials.get("access_token")
        phone_id = self.credentials.get("phone_number_id")
        if not token or not phone_id:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=(
                    "Missing credentials. Provide both 'access_token' and "
                    "'phone_number_id' from Meta Business Manager."
                ),
            )

        url = f"{_GRAPH_BASE}/{self._api_version()}/{phone_id}"
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(url, headers=self._auth_headers())
        except httpx.HTTPError as exc:
            logger.warning("whatsapp test_connection network error: %s", exc)
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=f"Network error contacting Meta Graph API: {exc}",
            )

        if resp.status_code == 200:
            data: dict[str, Any] = resp.json()
            display = data.get("display_phone_number") or data.get("verified_name")
            return IntegrationTestResult(
                ok=True,
                provider=self.provider,
                message=(
                    f"Connected to WhatsApp number {display}"
                    if display
                    else "Credentials are valid."
                ),
                details=data,
            )

        # Surface a tidy error from Meta's response body
        try:
            err_body = resp.json()
        except Exception:  # noqa: BLE001
            err_body = {"raw": resp.text[:500]}
        meta_msg = (
            (err_body.get("error") or {}).get("message")
            if isinstance(err_body, dict)
            else None
        )
        return IntegrationTestResult(
            ok=False,
            provider=self.provider,
            message=(
                f"Meta API returned {resp.status_code}: "
                f"{meta_msg or str(err_body)[:200]}"
            ),
            details=err_body if isinstance(err_body, dict) else None,
        )

    async def push_event(
        self,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Send an outbound message.

        Supported ``event_type`` values:

        * ``"text"`` — ``payload = {"to": "+9198...", "body": "hello"}``
        * ``"template"`` — ``payload = {"to": ..., "template_name": ...,
          "language": "en", "components": [...]}``
        * ``"raw"`` — ``payload`` is passed straight to Meta (escape hatch).
        """
        try:
            phone_id = self._require("phone_number_id")
        except ValueError as exc:
            return {"ok": False, "error": str(exc)}

        url = f"{_GRAPH_BASE}/{self._api_version()}/{phone_id}/messages"

        if event_type == "text":
            body = {
                "messaging_product": "whatsapp",
                "to": payload.get("to"),
                "type": "text",
                "text": {"body": payload.get("body", "")},
            }
        elif event_type == "template":
            body = {
                "messaging_product": "whatsapp",
                "to": payload.get("to"),
                "type": "template",
                "template": {
                    "name": payload.get("template_name"),
                    "language": {"code": payload.get("language", "en")},
                    "components": payload.get("components", []),
                },
            }
        elif event_type == "raw":
            body = {"messaging_product": "whatsapp", **payload}
        else:
            return {"ok": False, "error": f"Unsupported event_type '{event_type}'"}

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(url, json=body, headers=self._auth_headers())
                data = resp.json() if resp.content else {}
        except httpx.HTTPError as exc:
            logger.error("whatsapp push_event network error: %s", exc)
            return {"ok": False, "error": f"network: {exc}"}

        if resp.status_code // 100 == 2:
            message_id = None
            messages = data.get("messages") if isinstance(data, dict) else None
            if isinstance(messages, list) and messages:
                message_id = messages[0].get("id")
            return {"ok": True, "message_id": message_id, "response": data}

        meta_err = None
        if isinstance(data, dict):
            meta_err = (data.get("error") or {}).get("message")
        return {
            "ok": False,
            "status": resp.status_code,
            "error": meta_err or str(data)[:300],
        }

    async def verify_webhook_signature(
        self,
        body: bytes,
        headers: dict[str, str],
        secret: str,
    ) -> bool:
        """Verify the ``X-Hub-Signature-256`` header Meta attaches to webhooks."""
        import hashlib
        import hmac

        sig_header = (
            headers.get("X-Hub-Signature-256")
            or headers.get("x-hub-signature-256")
            or ""
        )
        if not sig_header.startswith("sha256="):
            return False
        expected = hmac.new(
            secret.encode("utf-8"), body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(sig_header.split("=", 1)[1], expected)

    async def handle_webhook(
        self,
        db,
        payload: dict[str, Any],
        headers: dict[str, str],
    ):
        """Minimal transform — LeadForge currently uses WhatsApp outbound only.

        When inbound message capture lands, this method should walk
        ``payload["entry"][*]["changes"][*]["value"]["messages"]`` and
        persist each one as an :class:`models.activity.Activity` row.
        """
        from services.integrations.base import WebhookResult

        return WebhookResult(
            ok=True,
            message="WhatsApp webhook received (inbound capture not yet wired).",
            details={"entries": len(payload.get("entry", []))},
        )
