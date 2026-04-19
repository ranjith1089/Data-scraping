"""LinkedIn Ads — manual-token integration.

Full end-user OAuth via LinkedIn's authorization code flow will land in a
later phase. For now the tenant pastes a long-lived ``access_token`` from
the LinkedIn Marketing Developer Platform (Bearer token with scopes
``r_ads``, ``r_ads_reporting``, and ``r_ads_leadgen_automation``) plus the
numeric ``account_id`` (also called the sponsored account URN suffix).

Credential shape
----------------
Decrypted credentials dict::

    {
        "access_token": "AQV...",
        "account_id": "509876543"
    }

Optional ``config`` keys::

    api_version — "202404" or newer; LinkedIn uses date-based versions.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from services.integrations import register
from services.integrations.base import BaseIntegration, IntegrationTestResult

logger = logging.getLogger(__name__)

_LINKEDIN_BASE = "https://api.linkedin.com/rest"
_DEFAULT_VERSION = "202404"
_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


@register("linkedin_ads")
class LinkedInAdsIntegration(BaseIntegration):
    provider = "linkedin_ads"
    display_name = "LinkedIn Ads"
    uses_oauth = True

    def _api_version(self) -> str:
        return str(self.config.get("api_version") or _DEFAULT_VERSION)

    async def test_connection(self) -> IntegrationTestResult:
        token = self.credentials.get("access_token")
        account_id = self.credentials.get("account_id")
        if not token or not account_id:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=(
                    "Missing credentials. Provide 'access_token' (Bearer token "
                    "with r_ads + r_ads_reporting scopes) and 'account_id' "
                    "(the numeric sponsored-account id)."
                ),
            )

        # Strip any urn: prefix the user may have pasted
        acc = str(account_id).split(":")[-1]
        url = f"{_LINKEDIN_BASE}/adAccounts/{acc}"
        headers = {
            "Authorization": f"Bearer {token}",
            "LinkedIn-Version": self._api_version(),
            "X-Restli-Protocol-Version": "2.0.0",
        }

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(url, headers=headers)
        except httpx.HTTPError as exc:
            return IntegrationTestResult(
                ok=False, provider=self.provider, message=f"Network error: {exc}"
            )

        if resp.status_code == 200:
            data = resp.json()
            return IntegrationTestResult(
                ok=True,
                provider=self.provider,
                message=(
                    f"Connected to ad account '{data.get('name', acc)}' "
                    f"({data.get('status', 'unknown status')})"
                ),
                details=data,
            )

        if resp.status_code == 401:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message="LinkedIn rejected the access token (401). Generate a new one.",
            )

        try:
            err = resp.json()
        except Exception:  # noqa: BLE001
            err = {"raw": resp.text[:300]}
        msg = None
        if isinstance(err, dict):
            msg = err.get("message") or err.get("serviceErrorCode") or err.get("error")
        return IntegrationTestResult(
            ok=False,
            provider=self.provider,
            message=f"LinkedIn returned {resp.status_code}: {msg or str(err)[:200]}",
            details=err if isinstance(err, dict) else None,
        )

    async def push_event(self, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "ok": False,
            "error": "LinkedIn Ads outbound push not yet wired.",
        }
