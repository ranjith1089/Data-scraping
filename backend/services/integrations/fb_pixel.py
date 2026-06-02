"""Facebook Pixel / Meta Conversions API (CAPI).

Server-side conversion tracking for Meta Ads. Pairs with the browser
pixel to deduplicate events and survive iOS 14+/cookie-blockers.

We use the ``test_event_code`` pattern for validation: the CAPI accepts
a probe event tagged with ``test_event_code`` and routes it to Meta's
Events Manager Test Events tab. A 200 back with ``events_received: 1``
is proof that the pixel id + token pair are valid.

Credential shape
----------------
Decrypted credentials dict::

    {
        "pixel_id": "1234567890",
        "access_token": "EAAG..."          # System-user or page token
    }

Optional ``config`` keys::

    test_event_code — label shown in Events Manager Test Events (default "AVEONAPEX_TEST")
    api_version     — default "v19.0"
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from services.integrations import register
from services.integrations.base import BaseIntegration, IntegrationTestResult

logger = logging.getLogger(__name__)

_GRAPH_BASE = "https://graph.facebook.com"
_DEFAULT_API_VERSION = "v19.0"
_DEFAULT_TEST_CODE = "AVEONAPEX_TEST"
_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


@register("fb_pixel")
class FBPixelIntegration(BaseIntegration):
    provider = "fb_pixel"
    display_name = "Facebook Pixel (Conversions API)"
    uses_oauth = False  # Long-lived token, same shape as Meta Ads

    def _api_version(self) -> str:
        return str(self.config.get("api_version") or _DEFAULT_API_VERSION)

    def _events_url(self) -> str:
        pixel = self.credentials.get("pixel_id", "")
        return f"{_GRAPH_BASE}/{self._api_version()}/{pixel}/events"

    async def test_connection(self) -> IntegrationTestResult:
        pixel_id = self.credentials.get("pixel_id")
        token = self.credentials.get("access_token")
        if not pixel_id or not token:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=(
                    "Missing credentials. Provide 'pixel_id' (from Events Manager) "
                    "and 'access_token' (generated in Events Manager → Settings)."
                ),
            )

        test_code = str(self.config.get("test_event_code") or _DEFAULT_TEST_CODE)
        body = {
            "data": [
                {
                    "event_name": "PageView",
                    "event_time": int(time.time()),
                    "action_source": "system_generated",
                    "event_source_url": "https://aveonapex.ai/test",
                    "user_data": {"client_ip_address": "127.0.0.1"},
                }
            ],
            "test_event_code": test_code,
            "access_token": token,
        }

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(self._events_url(), json=body)
        except httpx.HTTPError as exc:
            return IntegrationTestResult(
                ok=False, provider=self.provider, message=f"Network error: {exc}"
            )

        if resp.status_code == 200:
            data = resp.json()
            received = data.get("events_received")
            if received:
                return IntegrationTestResult(
                    ok=True,
                    provider=self.provider,
                    message=(
                        f"Connected. Probe received by Pixel {pixel_id} "
                        f"(test code '{test_code}'). Check Events Manager → Test Events."
                    ),
                    details=data,
                )
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=f"Meta accepted the call but events_received=0: {data}",
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
            message=f"Meta CAPI returned {resp.status_code}: {msg or str(err)[:200]}",
            details=err if isinstance(err, dict) else None,
        )

    async def push_event(self, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Send a real conversion event.

        ``payload`` matches Meta's CAPI schema::

            {
                "events": [{"event_name": "Lead", "event_time": ..., ...}],
                "test_event_code": "..."   # optional
            }
        """
        token = self.credentials.get("access_token")
        if not token:
            return {"ok": False, "error": "Missing access_token"}
        events = payload.get("events") or payload.get("data") or []
        if not events:
            return {"ok": False, "error": "payload.events is required"}

        body: dict[str, Any] = {"data": events, "access_token": token}
        if payload.get("test_event_code") or self.config.get("test_event_code"):
            body["test_event_code"] = (
                payload.get("test_event_code") or self.config["test_event_code"]
            )

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(self._events_url(), json=body)
        except httpx.HTTPError as exc:
            return {"ok": False, "error": f"network: {exc}"}
        if resp.status_code == 200:
            return {"ok": True, "response": resp.json()}
        return {"ok": False, "status": resp.status_code, "error": resp.text[:300]}
