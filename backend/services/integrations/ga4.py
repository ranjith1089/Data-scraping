"""Google Analytics 4 — Measurement Protocol integration.

GA4 ingestion uses the Measurement Protocol, which is a simple
``POST`` of JSON events to ``/mp/collect`` authenticated with an API
secret plus the Measurement ID. There is no OAuth involved.

Because ``/mp/collect`` silently returns ``204`` regardless of whether
the event is valid, ``test_connection`` hits the companion
``/debug/mp/collect`` endpoint which *does* validate payloads and
returns a ``validationMessages`` array. That lets us surface real
errors (wrong API secret, malformed event name, etc.) to the user.

Credential shape
----------------
Decrypted credentials dict::

    {
        "measurement_id": "G-XXXXXXXX",
        "api_secret": "xxxx..."
    }

Optional ``config`` keys::

    default_event_name — event to fire on test_connection (default "test_event")
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

import httpx

from services.integrations import register
from services.integrations.base import BaseIntegration, IntegrationTestResult

logger = logging.getLogger(__name__)

_COLLECT_URL = "https://www.google-analytics.com/mp/collect"
_DEBUG_URL = "https://www.google-analytics.com/debug/mp/collect"
_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


@register("ga4")
class GA4Integration(BaseIntegration):
    provider = "ga4"
    display_name = "Google Analytics 4"
    uses_oauth = False

    def _params(self) -> dict[str, str]:
        return {
            "measurement_id": str(self.credentials.get("measurement_id", "")),
            "api_secret": str(self.credentials.get("api_secret", "")),
        }

    async def test_connection(self) -> IntegrationTestResult:
        mid = self.credentials.get("measurement_id")
        secret = self.credentials.get("api_secret")
        if not mid or not secret:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=(
                    "Missing credentials. Provide 'measurement_id' (starts with G-) "
                    "and 'api_secret' (GA4 → Admin → Data Streams → Measurement Protocol API secrets)."
                ),
            )

        # Fire a probe event through the debug endpoint.
        payload = {
            "client_id": str(uuid.uuid4()),
            "events": [
                {
                    "name": str(self.config.get("default_event_name") or "aveonapex_test"),
                    "params": {"source": "aveonapex_test_connection"},
                }
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(_DEBUG_URL, params=self._params(), json=payload)
        except httpx.HTTPError as exc:
            return IntegrationTestResult(
                ok=False, provider=self.provider, message=f"Network error: {exc}"
            )

        if resp.status_code != 200 and resp.status_code != 204:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=f"GA4 debug endpoint returned {resp.status_code}: {resp.text[:200]}",
            )

        # Success = 2xx AND validationMessages is empty. Any populated
        # validationMessages array means the API key / measurement id are
        # wrong or the payload is malformed.
        try:
            data = resp.json()
        except Exception:  # noqa: BLE001
            data = {}
        messages = data.get("validationMessages") if isinstance(data, dict) else None
        if messages:
            descs = [m.get("description") or m.get("validationCode") for m in messages]
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=f"GA4 rejected the probe: {'; '.join(str(d) for d in descs if d)[:250]}",
                details=data,
            )

        return IntegrationTestResult(
            ok=True,
            provider=self.provider,
            message=f"Connected. Measurement ID {mid} accepts events.",
            details=data if isinstance(data, dict) else None,
        )

    async def push_event(self, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Forward a Measurement Protocol event.

        ``payload`` should match Google's schema::

            {
                "client_id": "...",
                "events": [{"name": "...", "params": {...}}]
            }
        """
        if not payload.get("events"):
            return {"ok": False, "error": "payload.events is required"}
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.post(_COLLECT_URL, params=self._params(), json=payload)
        except httpx.HTTPError as exc:
            return {"ok": False, "error": f"network: {exc}"}
        # /mp/collect always returns 204 on success.
        if resp.status_code in (200, 204):
            return {"ok": True}
        return {"ok": False, "status": resp.status_code, "error": resp.text[:200]}
