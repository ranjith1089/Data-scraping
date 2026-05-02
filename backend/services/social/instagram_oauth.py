"""Instagram Connect OAuth flow.

LeadForge owns one Meta App. Each tenant clicks **Connect Instagram**
which:

1. ``begin_oauth(tenant_id)`` returns Meta's authorize URL + a CSRF
   ``state`` token. The state is stored in Redis (60-second TTL) so
   the callback can verify it came from the same browser session.
2. User authenticates, picks the FB Page they manage, lands on
   ``/social/oauth/instagram/callback?code=...&state=...``.
3. ``exchange_code()`` swaps code → user access token → long-lived
   user access token → page access token + Instagram Business id.
4. The Page Access Token + Instagram Business id get Fernet-encrypted
   into the tenant's ``Integration(provider='instagram_dm')`` row.
5. We subscribe the page to webhook events
   (``messages, comments, mentions, message_reactions``).

Token TTL: page access tokens are long-lived (~60 days). The
``social.refresh_meta_tokens`` APScheduler job runs daily to refresh
them before expiry.
"""

from __future__ import annotations

import logging
import secrets
import urllib.parse
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.crypto import encrypt_json
from models.integration import Integration

logger = logging.getLogger(__name__)

_GRAPH_BASE = "https://graph.facebook.com"
_API_VERSION = "v19.0"

# Scopes required for the Phase 1 feature set. App Review must
# approve all of these before live tenants can connect.
_REQUIRED_SCOPES = [
    "instagram_basic",
    "instagram_manage_messages",
    "instagram_manage_comments",
    "pages_show_list",
    "pages_messaging",
    "pages_read_engagement",
    "business_management",
]

# Webhook fields we ask the page to subscribe to. Must match what
# we have configured on the Meta App's webhooks settings page.
_WEBHOOK_FIELDS = [
    "messages",
    "comments",
    "mentions",
    "message_reactions",
]


def _redirect_uri() -> str:
    base = (settings.PUBLIC_BASE_URL or "http://localhost:8000").rstrip("/")
    return f"{base}/api/v1/social/oauth/instagram/callback"


def build_authorize_url(state: str) -> str:
    """Construct the Meta authorize URL with the LeadForge App Id +
    redirect URI + scopes + CSRF state.

    Caller is responsible for storing ``state`` against the current
    user's session for verification on callback.
    """
    if not settings.META_APP_ID:
        raise RuntimeError("META_APP_ID env var is not configured.")
    params = {
        "client_id": settings.META_APP_ID,
        "redirect_uri": _redirect_uri(),
        "scope": ",".join(_REQUIRED_SCOPES),
        "response_type": "code",
        "state": state,
    }
    return (
        f"https://www.facebook.com/{_API_VERSION}/dialog/oauth?"
        + urllib.parse.urlencode(params)
    )


def generate_state() -> str:
    """Return a CSRF state token. Caller stores it in Redis with a
    short TTL keyed against the user id."""
    return secrets.token_urlsafe(32)


# ---------------------------------------------------------------------
# Token exchange + page selection
# ---------------------------------------------------------------------

async def exchange_code_for_token(code: str) -> dict[str, Any]:
    """Step 1 of 2 — short-lived USER access token from auth code."""
    if not settings.META_APP_ID or not settings.META_APP_SECRET:
        raise RuntimeError(
            "META_APP_ID / META_APP_SECRET must be configured."
        )
    url = f"{_GRAPH_BASE}/{_API_VERSION}/oauth/access_token"
    params = {
        "client_id": settings.META_APP_ID,
        "client_secret": settings.META_APP_SECRET,
        "redirect_uri": _redirect_uri(),
        "code": code,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url, params=params)
    if resp.status_code != 200:
        try:
            err = resp.json()
        except Exception:  # noqa: BLE001
            err = {"raw": resp.text[:200]}
        raise RuntimeError(f"Meta token exchange failed: {err}")
    return resp.json()


async def get_long_lived_token(short_lived: str) -> dict[str, Any]:
    """Step 2 of 2 — exchange short-lived for ~60-day token."""
    url = f"{_GRAPH_BASE}/{_API_VERSION}/oauth/access_token"
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": settings.META_APP_ID,
        "client_secret": settings.META_APP_SECRET,
        "fb_exchange_token": short_lived,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url, params=params)
    if resp.status_code != 200:
        try:
            err = resp.json()
        except Exception:  # noqa: BLE001
            err = {"raw": resp.text[:200]}
        raise RuntimeError(f"Long-lived token exchange failed: {err}")
    return resp.json()


async def list_pages(user_token: str) -> list[dict[str, Any]]:
    """Fetch the FB Pages this user can manage. Each row carries its
    own page access token + the linked Instagram Business Account id
    (when the page is linked to one).
    """
    url = f"{_GRAPH_BASE}/{_API_VERSION}/me/accounts"
    params = {
        "fields": "id,name,access_token,instagram_business_account",
        "access_token": user_token,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url, params=params)
    if resp.status_code != 200:
        return []
    data = resp.json() or {}
    return list(data.get("data") or [])


async def subscribe_page_to_webhooks(
    page_id: str, page_access_token: str
) -> dict[str, Any]:
    """Subscribe the page to our webhook fields so Meta sends events
    to our inbound receiver. Idempotent — safe to call repeatedly.
    """
    url = f"{_GRAPH_BASE}/{_API_VERSION}/{page_id}/subscribed_apps"
    payload = {
        "subscribed_fields": ",".join(_WEBHOOK_FIELDS),
        "access_token": page_access_token,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(url, data=payload)
    return {
        "ok": resp.status_code // 100 == 2,
        "status": resp.status_code,
        "body": (resp.json() if resp.content else {}),
    }


# ---------------------------------------------------------------------
# Connection persistence
# ---------------------------------------------------------------------

async def upsert_instagram_integration(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    user_id: UUID,
    page_id: str,
    page_access_token: str,
    instagram_business_id: str,
    handle: Optional[str],
) -> Integration:
    """Find-or-create the tenant's ``instagram_dm`` Integration row and
    store the freshly-issued credentials Fernet-encrypted."""
    creds = {
        "access_token": page_access_token,
        "page_id": page_id,
        "instagram_business_id": instagram_business_id,
        "user_id": str(user_id),
    }
    config = {
        "handle": handle,
        "subscribed_fields": _WEBHOOK_FIELDS,
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }

    result = await db.execute(
        select(Integration).where(
            Integration.tenant_id == tenant_id,
            Integration.provider == "instagram_dm",
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.credentials_encrypted = encrypt_json(creds)
        merged_config = dict(existing.config or {})
        merged_config.update(config)
        existing.config = merged_config
        existing.status = "connected"
        existing.last_error = None
        existing.updated_at = datetime.now(timezone.utc)
        return existing

    integration = Integration(
        tenant_id=tenant_id,
        provider="instagram_dm",
        display_name=f"Instagram (@{handle})" if handle else "Instagram",
        status="connected",
        credentials_encrypted=encrypt_json(creds),
        config=config,
        created_by=user_id,
    )
    db.add(integration)
    await db.flush()
    return integration
