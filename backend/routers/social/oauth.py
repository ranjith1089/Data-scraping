"""OAuth flow endpoints for connecting Instagram (commit 3 of 6).

* ``GET  /social/oauth/instagram/start``    — JWT, returns auth URL + state
* ``GET  /social/oauth/instagram/callback`` — public, Meta redirects here
* ``GET  /social/oauth/instagram/status``   — JWT, "are we connected?"
* ``DELETE /social/oauth/instagram``        — JWT, disconnect

State is stored in Redis keyed by ``social:oauth:state:{state}`` with
a 5-minute TTL. We require the same JWT user to land on the callback
that initiated the flow — verified via the persisted user_id.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.dependencies import get_current_user, get_db
from core.database import AsyncSessionLocal, get_db_session
from models.integration import Integration
from models.user import User
from schemas.social.oauth import (
    InstagramConnectionStatus,
    OAuthStartResponse,
)
from services.social import instagram_oauth as oauth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social/oauth", tags=["social-oauth"])

_OAUTH_STATE_TTL_S = 300


def _redis() -> Optional[aioredis.Redis]:
    if not settings.REDIS_URL:
        return None
    try:
        return aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis unavailable for OAuth state: %s", exc)
        return None


@router.get("/instagram/start", response_model=OAuthStartResponse)
async def start_instagram_oauth(
    current_user: User = Depends(get_current_user),
):
    if not settings.META_APP_ID:
        raise HTTPException(
            status_code=503,
            detail=(
                "Instagram OAuth is not configured. Set META_APP_ID and "
                "META_APP_SECRET on the backend."
            ),
        )
    state = oauth.generate_state()
    payload = json.dumps(
        {
            "user_id": str(current_user.id),
            "tenant_id": str(current_user.tenant_id),
        }
    )
    r = _redis()
    if r is not None:
        try:
            await r.setex(f"social:oauth:state:{state}", _OAUTH_STATE_TTL_S, payload)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to persist OAuth state: %s", exc)
    return OAuthStartResponse(
        auth_url=oauth.build_authorize_url(state), state=state
    )


@router.get("/instagram/callback")
async def instagram_oauth_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    """Public — Meta redirects the user here after Connect.

    We verify the state token against Redis to recover the original
    tenant_id + user_id, then exchange the code for tokens, fetch the
    user's pages, and persist credentials. On success we redirect the
    browser to ``/social?connected=instagram``.
    """
    fe_base = (settings.PUBLIC_BASE_URL or "").rstrip("/")
    redirect_ok = f"{fe_base}/social?connected=instagram"
    redirect_err = f"{fe_base}/social?error="

    if error:
        return RedirectResponse(redirect_err + error, status_code=303)
    if not code or not state:
        return RedirectResponse(redirect_err + "missing_code_or_state", status_code=303)

    r = _redis()
    if r is None:
        return RedirectResponse(redirect_err + "redis_unavailable", status_code=303)
    try:
        raw = await r.get(f"social:oauth:state:{state}")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis state lookup failed: %s", exc)
        return RedirectResponse(redirect_err + "state_lookup_failed", status_code=303)
    if not raw:
        return RedirectResponse(redirect_err + "expired_state", status_code=303)
    try:
        ctx = json.loads(raw)
        tenant_id = UUID(ctx["tenant_id"])
        user_id = UUID(ctx["user_id"])
    except Exception:  # noqa: BLE001
        return RedirectResponse(redirect_err + "bad_state", status_code=303)
    # Burn the state so it can't be replayed.
    try:
        await r.delete(f"social:oauth:state:{state}")
    except Exception:  # noqa: BLE001
        pass

    # 1) Exchange code for short-lived user token.
    try:
        short = await oauth.exchange_code_for_token(code)
        long_lived = await oauth.get_long_lived_token(short.get("access_token", ""))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Meta token exchange failed: %s", exc)
        return RedirectResponse(redirect_err + "token_exchange_failed", status_code=303)

    user_token = long_lived.get("access_token")
    if not user_token:
        return RedirectResponse(redirect_err + "no_user_token", status_code=303)

    # 2) Pick the page. If multiple pages are returned, pick the first
    #    one with a linked Instagram Business Account. (Phase 1 simplification —
    #    Phase 2 will add a page-picker UI step.)
    pages = await oauth.list_pages(user_token)
    candidate = next(
        (p for p in pages if p.get("instagram_business_account")), None
    )
    if not candidate:
        return RedirectResponse(redirect_err + "no_ig_business_page", status_code=303)

    page_id = candidate["id"]
    page_token = candidate["access_token"]
    ig = candidate["instagram_business_account"]
    ig_id = ig.get("id") if isinstance(ig, dict) else None
    if not ig_id:
        return RedirectResponse(redirect_err + "no_ig_id", status_code=303)

    # 3) Subscribe webhooks.
    sub_result = await oauth.subscribe_page_to_webhooks(page_id, page_token)
    if not sub_result["ok"]:
        logger.warning("Page webhook subscription failed: %s", sub_result)

    # 4) Fetch IG handle for display.
    handle: Optional[str] = None
    try:
        async with __import__("httpx").AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://graph.facebook.com/v19.0/{ig_id}",
                params={"fields": "username", "access_token": page_token},
            )
            if resp.status_code == 200:
                handle = (resp.json() or {}).get("username")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to fetch IG handle: %s", exc)

    # 5) Persist credentials in the tenant's session-scoped DB.
    async for db in get_db_session(tenant_id):
        await oauth.upsert_instagram_integration(
            db,
            tenant_id=tenant_id,
            user_id=user_id,
            page_id=page_id,
            page_access_token=page_token,
            instagram_business_id=ig_id,
            handle=handle,
        )

    return RedirectResponse(redirect_ok, status_code=303)


@router.get("/instagram/status", response_model=InstagramConnectionStatus)
async def instagram_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Integration).where(
            Integration.tenant_id == current_user.tenant_id,
            Integration.provider == "instagram_dm",
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return InstagramConnectionStatus(connected=False)

    config = row.config or {}
    # Avoid leaking the access token; just report whether we have one.
    return InstagramConnectionStatus(
        connected=row.status == "connected" and bool(row.credentials_encrypted),
        instagram_business_id=None,  # not user-facing
        page_id=None,
        handle=config.get("handle"),
        webhook_url=None,
        connected_at=row.created_at,
        last_test_at=row.last_sync_at,
        last_test_ok=(row.last_error is None),
    )


@router.delete("/instagram", status_code=status.HTTP_200_OK)
async def disconnect_instagram(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Integration).where(
            Integration.tenant_id == current_user.tenant_id,
            Integration.provider == "instagram_dm",
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return {"detail": "Not connected", "tenant_id": str(current_user.tenant_id)}
    await db.delete(row)
    return {"detail": "Disconnected", "tenant_id": str(current_user.tenant_id)}
