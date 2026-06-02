"""Instagram DM — Meta Graph API plugin (Phase 1).

Sends and receives DMs through the Instagram Messaging API. Mirrors the
shape of ``meta_ads.py`` and ``whatsapp.py``: a per-tenant integration
row holds the Page Access Token + Instagram Business Account id, and
this plugin's ``test_connection`` / ``push_event`` / ``handle_webhook``
methods are the runtime adapters.

Auth model
----------
AveonApex owns ONE Meta App. Each tenant clicks "Connect Instagram"
which kicks off the OAuth flow in ``services/social/instagram_oauth.py``
and stores the resulting Page Access Token + Instagram Business id in
this plugin's credentials dict. The token is long-lived (60 days) and
gets refreshed by the ``social.refresh_meta_tokens`` APScheduler job.

Credential shape (decrypted JSON)::

    {
        "access_token": "EAAG...",                # Page Access Token
        "page_id": "1234567890",                  # Facebook Page id
        "instagram_business_id": "17841...",      # IG Business Account id
        "user_id": "1234..."                      # Meta user id of installer
    }

Optional config keys::

    api_version  — "v19.0" default
    handle       — cached username so the UI can show "@yourpage"
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from services.integrations import register
from services.integrations.base import (
    BaseIntegration,
    IntegrationTestResult,
    WebhookResult,
)

logger = logging.getLogger(__name__)

_GRAPH_BASE = "https://graph.facebook.com"
_DEFAULT_API_VERSION = "v19.0"
_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


@register("instagram_dm")
class InstagramDMIntegration(BaseIntegration):
    """Per-tenant Instagram messaging integration."""

    provider = "instagram_dm"
    display_name = "Instagram (DM Automation)"
    uses_oauth = True

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _api_version(self) -> str:
        return str(self.config.get("api_version") or _DEFAULT_API_VERSION)

    def _require(self, key: str) -> str:
        v = self.credentials.get(key)
        if not v:
            raise ValueError(f"instagram_dm: missing credential '{key}'")
        return str(v)

    # ------------------------------------------------------------------
    # BaseIntegration surface
    # ------------------------------------------------------------------

    async def test_connection(self) -> IntegrationTestResult:
        """Verify the Page Access Token still works by reading the
        connected Instagram Business Account.

        Hits ``GET /{instagram_business_id}?fields=id,username,name``.
        Returns a clean message with the IG handle on success.
        """
        token = self.credentials.get("access_token")
        ig_id = self.credentials.get("instagram_business_id")
        if not token or not ig_id:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=(
                    "Missing credentials. Connect Instagram via the "
                    "Social → Connect button to store the access token."
                ),
            )

        url = f"{_GRAPH_BASE}/{self._api_version()}/{ig_id}"
        params = {"fields": "id,username,name", "access_token": token}
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(url, params=params)
        except httpx.HTTPError as exc:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=f"Network error contacting Meta: {exc}",
            )

        if resp.status_code == 200:
            data = resp.json()
            handle = data.get("username") or data.get("name") or ig_id
            return IntegrationTestResult(
                ok=True,
                provider=self.provider,
                message=f"Connected to @{handle}",
                details=data,
            )

        try:
            err = resp.json()
        except Exception:  # noqa: BLE001
            err = {"raw": resp.text[:300]}
        msg = None
        if isinstance(err, dict):
            msg = (err.get("error") or {}).get("message")
        return IntegrationTestResult(
            ok=False,
            provider=self.provider,
            message=f"Meta API returned {resp.status_code}: {msg or str(err)[:200]}",
            details=err if isinstance(err, dict) else None,
        )

    async def push_event(
        self, event_type: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Send an outbound DM via Instagram Messaging API.

        Supported ``event_type`` values:

        * ``"text"`` — ``payload = {"recipient_id": "...", "body": "..."}``

        The recipient id is the IGSID (Instagram-scoped user id) we
        captured from the inbound webhook on the original DM/comment.
        """
        try:
            token = self._require("access_token")
            page_id = self._require("page_id")
        except ValueError as exc:
            return {"ok": False, "error": str(exc)}

        if event_type != "text":
            return {"ok": False, "error": f"Unsupported event_type '{event_type}'"}

        recipient = payload.get("recipient_id")
        body = payload.get("body") or ""
        if not recipient:
            return {"ok": False, "error": "missing recipient_id"}
        if not body:
            return {"ok": False, "error": "empty body"}

        # Instagram Messaging endpoint sits on the Page id, not the
        # Instagram Business Account id.
        url = f"{_GRAPH_BASE}/{self._api_version()}/{page_id}/messages"
        params = {"access_token": token}
        json_body = {
            "recipient": {"id": recipient},
            "message": {"text": body},
            "messaging_type": "RESPONSE",
        }
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(url, params=params, json=json_body)
        except httpx.HTTPError as exc:
            logger.error("instagram_dm push_event network error: %s", exc)
            return {"ok": False, "error": f"network: {exc}"}

        if resp.status_code // 100 == 2:
            data = resp.json() if resp.content else {}
            return {
                "ok": True,
                "message_id": data.get("message_id"),
                "response": data,
            }

        try:
            err = resp.json()
        except Exception:  # noqa: BLE001
            err = {"raw": resp.text[:300]}
        msg = None
        if isinstance(err, dict):
            msg = (err.get("error") or {}).get("message")
        return {
            "ok": False,
            "status": resp.status_code,
            "error": msg or str(err)[:300],
        }

    async def verify_webhook_signature(
        self, body: bytes, headers: dict[str, str], secret: str
    ) -> bool:
        """Meta signs every webhook with X-Hub-Signature-256 over the raw body.

        ``secret`` is the Meta App Secret (not a per-tenant value)
        because Meta uses the app secret for all webhook deliveries.
        Caller looks it up from settings before calling us.
        """
        import hashlib
        import hmac

        sig = (
            headers.get("X-Hub-Signature-256")
            or headers.get("x-hub-signature-256")
            or ""
        )
        if not sig.startswith("sha256="):
            return False
        expected = hmac.new(
            secret.encode("utf-8"), body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(sig.split("=", 1)[1], expected)

    async def handle_webhook(
        self, db, payload: dict[str, Any], headers: dict[str, str]
    ) -> WebhookResult:
        """Handled by ``routers/social/webhook_inbound.py`` directly so
        it can read the request body for signature verification before
        any deserialisation. Kept as a no-op here so the BaseIntegration
        contract is satisfied.
        """
        return WebhookResult(
            ok=True,
            message=(
                "Instagram webhook delivery routed by routers/social/"
                "webhook_inbound.py — see that handler for the actual "
                "ingestion path."
            ),
            details={"entry_count": len(payload.get("entry", []))},
        )
