"""Meta Ads (Facebook / Instagram Lead Ads) — manual-token integration.

Full end-user OAuth with Embedded Signup will land in a later phase; for
now this plugin supports the "manual token" path: the tenant's Business
Manager admin generates a long-lived system-user access token from Meta
Business Manager → System Users → Generate Token (with ``ads_read``,
``ads_management``, and ``leads_retrieval`` scopes) and pastes it here.

Credential shape
----------------
Decrypted credentials dict::

    {
        "access_token": "EAAG...",
        "ad_account_id": "act_1234567890"   # "act_" prefix included
    }

Optional ``config`` keys::

    app_secret       — for webhook signature verification
    api_version      — default "v19.0"
    page_id          — default Facebook page used as sender
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from services.integrations import register
from services.integrations.base import BaseIntegration, IntegrationTestResult

logger = logging.getLogger(__name__)

_GRAPH_BASE = "https://graph.facebook.com"
_DEFAULT_API_VERSION = "v19.0"
_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


@register("meta_ads")
class MetaAdsIntegration(BaseIntegration):
    provider = "meta_ads"
    display_name = "Meta Ads"
    uses_oauth = True  # OAuth app exists, but current path accepts a long-lived token

    def _api_version(self) -> str:
        return str(self.config.get("api_version") or _DEFAULT_API_VERSION)

    async def test_connection(self) -> IntegrationTestResult:
        token = self.credentials.get("access_token")
        ad_account_id = self.credentials.get("ad_account_id")
        if not token or not ad_account_id:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=(
                    "Missing credentials. Provide 'access_token' (long-lived "
                    "system-user token) and 'ad_account_id' (with the 'act_' prefix)."
                ),
            )

        # Normalise prefix
        acc = ad_account_id if ad_account_id.startswith("act_") else f"act_{ad_account_id}"
        url = f"{_GRAPH_BASE}/{self._api_version()}/{acc}"
        params = {"fields": "id,name,account_status,currency", "access_token": token}

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(url, params=params)
        except httpx.HTTPError as exc:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=f"Network error contacting Meta Graph API: {exc}",
            )

        if resp.status_code == 200:
            data = resp.json()
            return IntegrationTestResult(
                ok=True,
                provider=self.provider,
                message=(
                    f"Connected to ad account '{data.get('name')}' "
                    f"({data.get('currency')})"
                ),
                details=data,
            )

        try:
            err_body = resp.json()
        except Exception:  # noqa: BLE001
            err_body = {"raw": resp.text[:400]}
        msg = (err_body.get("error") or {}).get("message") if isinstance(err_body, dict) else None
        return IntegrationTestResult(
            ok=False,
            provider=self.provider,
            message=f"Meta API returned {resp.status_code}: {msg or str(err_body)[:200]}",
            details=err_body if isinstance(err_body, dict) else None,
        )

    async def verify_webhook_signature(
        self, body: bytes, headers: dict[str, str], secret: str
    ) -> bool:
        import hashlib
        import hmac

        sig = headers.get("X-Hub-Signature-256") or headers.get("x-hub-signature-256") or ""
        if not sig.startswith("sha256="):
            return False
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig.split("=", 1)[1], expected)

    async def push_event(self, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "ok": False,
            "error": "Meta Ads outbound push (conversion upload) not yet wired.",
        }
