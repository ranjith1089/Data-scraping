"""Google Ads — manual-token integration.

Google Ads API authentication is a three-legged beast:

* A ``developer_token`` granted by Google (one per MCC).
* An OAuth ``refresh_token`` (long-lived) owned by the user, exchanged
  against the Ads API using the tenant's Google Cloud ``client_id`` /
  ``client_secret``.
* A ``customer_id`` for the actual ads account (10 digits, no dashes).
* Optionally a ``login_customer_id`` when operating an MCC login.

Full end-user OAuth with hosted redirect URIs ships in a later phase.
For now this plugin accepts all four values via the credential form.

Credential shape
----------------
Decrypted credentials dict::

    {
        "developer_token": "...",
        "client_id": "...apps.googleusercontent.com",
        "client_secret": "GOCSPX-...",
        "refresh_token": "1//0g...",
        "customer_id": "1234567890"
    }

Optional ``config`` keys::

    login_customer_id — MCC customer id used as "login-customer-id" header
    api_version       — default "v16"
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from services.integrations import register
from services.integrations.base import BaseIntegration, IntegrationTestResult

logger = logging.getLogger(__name__)

_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
_ADS_BASE = "https://googleads.googleapis.com"
_DEFAULT_API_VERSION = "v16"
_TIMEOUT = httpx.Timeout(20.0, connect=5.0)


@register("google_ads")
class GoogleAdsIntegration(BaseIntegration):
    provider = "google_ads"
    display_name = "Google Ads"
    uses_oauth = True

    def _api_version(self) -> str:
        return str(self.config.get("api_version") or _DEFAULT_API_VERSION)

    async def _exchange_refresh_token(self, client: httpx.AsyncClient) -> tuple[str | None, str | None]:
        """Trade the refresh_token for a short-lived access token."""
        try:
            resp = await client.post(
                _OAUTH_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "client_id": self.credentials.get("client_id", ""),
                    "client_secret": self.credentials.get("client_secret", ""),
                    "refresh_token": self.credentials.get("refresh_token", ""),
                },
            )
        except httpx.HTTPError as exc:
            return None, f"Network error hitting Google OAuth: {exc}"

        if resp.status_code == 200:
            return resp.json().get("access_token"), None

        try:
            err = resp.json()
        except Exception:  # noqa: BLE001
            err = {"raw": resp.text[:300]}
        msg = err.get("error_description") or err.get("error") or str(err)[:200]
        return None, f"OAuth refresh failed ({resp.status_code}): {msg}"

    async def test_connection(self) -> IntegrationTestResult:
        required = ("developer_token", "client_id", "client_secret", "refresh_token", "customer_id")
        missing = [k for k in required if not self.credentials.get(k)]
        if missing:
            return IntegrationTestResult(
                ok=False,
                provider=self.provider,
                message=f"Missing credentials: {', '.join(missing)}",
            )

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                access_token, err = await self._exchange_refresh_token(client)
                if err or not access_token:
                    return IntegrationTestResult(
                        ok=False, provider=self.provider, message=err or "No access_token returned"
                    )

                # Hit listAccessibleCustomers — cheapest authenticated call.
                headers = {
                    "Authorization": f"Bearer {access_token}",
                    "developer-token": self.credentials["developer_token"],
                }
                login_id = self.config.get("login_customer_id")
                if login_id:
                    headers["login-customer-id"] = str(login_id).replace("-", "")

                url = f"{_ADS_BASE}/{self._api_version()}/customers:listAccessibleCustomers"
                resp = await client.get(url, headers=headers)
        except httpx.HTTPError as exc:
            return IntegrationTestResult(
                ok=False, provider=self.provider, message=f"Network error: {exc}"
            )

        if resp.status_code == 200:
            data = resp.json()
            resource_names = data.get("resourceNames") or []
            target = str(self.credentials["customer_id"]).replace("-", "")
            matched = any(target in name for name in resource_names)
            if not matched and resource_names:
                return IntegrationTestResult(
                    ok=False,
                    provider=self.provider,
                    message=(
                        f"Authenticated, but customer_id {target} is not accessible. "
                        f"Accessible: {resource_names[:5]}"
                    ),
                    details=data,
                )
            return IntegrationTestResult(
                ok=True,
                provider=self.provider,
                message=f"Connected. {len(resource_names)} Ads customer(s) accessible.",
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
            message=f"Google Ads API returned {resp.status_code}: {msg or str(err)[:200]}",
            details=err if isinstance(err, dict) else None,
        )

    async def push_event(self, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "ok": False,
            "error": "Google Ads outbound push (offline conversion upload) not yet wired.",
        }
