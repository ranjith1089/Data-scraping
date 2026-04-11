"""WhatsApp Business via Gupshup — BSP integration (Option D).

Gupshup is a WhatsApp Business Solution Provider (BSP) headquartered in
Bangalore and is the most popular BSP for Indian B2B workloads. Using a
BSP means:

* No Meta app review — Gupshup owns the relationship with Meta.
* Faster WhatsApp Business account approval (usually < 48h in India).
* A single ``api_key`` + ``source`` phone number replaces the full Meta
  OAuth dance.
* A small per-message markup on top of Meta's conversation rates.

Docs: https://docs.gupshup.io/reference/send-a-message

Credential shape
----------------
The decrypted credentials dict is expected to contain::

    {
        "api_key": "abcd1234...",     # Gupshup API key from the dashboard
        "source": "919876543210"      # Your approved WA number (no +)
    }

Optional ``config`` keys::

    app_name      — Your Gupshup app name (defaults to "LeadForgeAI")
    src_name      — Optional display name override
    channel       — "whatsapp" (default) or "sms"
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from services.integrations import register
from services.integrations.base import BaseIntegration, IntegrationTestResult

logger = logging.getLogger(__name__)

_GUPSHUP_SEND_URL = "https://api.gupshup.io/sm/api/v1/msg"
_GUPSHUP_WALLET_URL = "https://api.gupshup.io/sm/api/v1/wallet/balance"
_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


@register("whatsapp_gupshup")
class WhatsAppGupshupIntegration(BaseIntegration):
    """Gupshup BSP WhatsApp Business connector — recommended for India."""

    provider = "whatsapp_gupshup"
    display_name = "WhatsApp Business (Gupshup)"
    uses_oauth = False  # Simple API key

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _require(self, key: str) -> str:
        val = self.credentials.get(key)
        if not val:
            raise ValueError(f"whatsapp_gupshup: missing credential '{key}'")
        return str(val)

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._require("api_key"),
            "Content-Type": "application/x-www-form-urlencoded",
            "Cache-Control": "no-cache",
        }

    def _app_name(self) -> str:
        return str(self.config.get("app_name") or "LeadForgeAI")

    def _channel(self) -> str:
        return str(self.config.get("channel") or "whatsapp")

    # ------------------------------------------------------------------
    # BaseIntegration surface
    # ------------------------------------------------------------------

    async def test_connection(self) -> IntegrationTestResult:
        """Hit Gupshup's wallet balance endpoint — cheapest verified call."""
        api_key = self.credentials.get("api_key")
        source = self.credentials.get("source")
        if not api_key or not source:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=(
                    "Missing credentials. Provide 'api_key' from the Gupshup "
                    "dashboard and 'source' (your approved WhatsApp number)."
                ),
            )

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(
                    _GUPSHUP_WALLET_URL,
                    headers={"apikey": api_key, "Cache-Control": "no-cache"},
                )
        except httpx.HTTPError as exc:
            logger.warning("gupshup test_connection network error: %s", exc)
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=f"Network error contacting Gupshup: {exc}",
            )

        if resp.status_code == 200:
            try:
                data: dict[str, Any] = resp.json()
            except json.JSONDecodeError:
                data = {"raw": resp.text[:200]}
            balance = None
            if isinstance(data, dict):
                balance = (
                    data.get("balance")
                    or (data.get("walletResponse") or {}).get("currentBalance")
                )
            return IntegrationTestResult(
                ok=True,
                provider=self.provider,
                message=(
                    f"Connected. Wallet balance: {balance}"
                    if balance is not None
                    else "Gupshup credentials are valid."
                ),
                details=data if isinstance(data, dict) else None,
            )

        if resp.status_code == 401:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message="Gupshup rejected the API key (401). Re-copy it from the dashboard.",
            )

        return IntegrationTestResult(
            ok=False,
            provider=self.provider,
            message=f"Gupshup returned {resp.status_code}: {resp.text[:200]}",
        )

    async def push_event(
        self,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Send an outbound message via Gupshup.

        ``event_type``:

        * ``"text"`` — ``payload = {"to": "919876...", "body": "hi"}``
        * ``"template"`` — ``payload = {"to": ..., "template_id": ...,
          "params": [...]}``
        """
        try:
            api_key = self._require("api_key")  # noqa: F841 — triggers validation
            source = self._require("source")
        except ValueError as exc:
            return {"ok": False, "error": str(exc)}

        to = str(payload.get("to", "")).lstrip("+")
        if not to:
            return {"ok": False, "error": "payload.to is required"}

        if event_type == "text":
            body = payload.get("body") or ""
            form = {
                "channel": self._channel(),
                "source": source,
                "destination": to,
                "message": json.dumps({"type": "text", "text": body}),
                "src.name": self.config.get("src_name") or self._app_name(),
            }
        elif event_type == "template":
            form = {
                "channel": self._channel(),
                "source": source,
                "destination": to,
                "template": json.dumps(
                    {
                        "id": payload.get("template_id"),
                        "params": payload.get("params", []),
                    }
                ),
                "src.name": self.config.get("src_name") or self._app_name(),
            }
        else:
            return {"ok": False, "error": f"Unsupported event_type '{event_type}'"}

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(
                    _GUPSHUP_SEND_URL, data=form, headers=self._headers()
                )
                try:
                    data = resp.json()
                except json.JSONDecodeError:
                    data = {"raw": resp.text[:500]}
        except httpx.HTTPError as exc:
            logger.error("gupshup push_event network error: %s", exc)
            return {"ok": False, "error": f"network: {exc}"}

        if resp.status_code // 100 == 2:
            return {
                "ok": True,
                "message_id": data.get("messageId") if isinstance(data, dict) else None,
                "response": data,
            }

        return {
            "ok": False,
            "status": resp.status_code,
            "error": (
                data.get("message")
                if isinstance(data, dict)
                else str(data)[:300]
            ),
        }

    async def handle_webhook(
        self,
        db,
        payload: dict[str, Any],
        headers: dict[str, str],
    ):
        """Gupshup posts delivery + inbound events to a configured callback URL.

        For now we just acknowledge — campaign delivery tracking and inbound
        message-to-activity capture will land alongside the Meta direct plugin.
        """
        from services.integrations.base import WebhookResult

        event_type = (
            payload.get("type") or payload.get("eventType") or "unknown"
        )
        return WebhookResult(
            ok=True,
            message=f"Gupshup webhook received: {event_type}",
            details={"event_type": event_type},
        )
