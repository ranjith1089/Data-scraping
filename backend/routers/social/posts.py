"""List + refresh cached Instagram posts.

Posts are cached in ``social_posts`` so the campaign UI doesn't refetch
from Meta on every render. The ``refresh`` endpoint pulls the latest
~25 media items from the connected Instagram Business Account and
upserts them by ``external_post_id``.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.crypto import decrypt_json
from core.dependencies import get_current_user, get_db
from models.integration import Integration
from models.social.social_post import SocialPost
from models.user import User
from schemas.social.campaigns import SocialPostResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social/posts", tags=["social-posts"])


@router.get("/", response_model=List[SocialPostResponse])
async def list_posts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SocialPost)
        .where(SocialPost.tenant_id == current_user.tenant_id)
        .order_by(SocialPost.posted_at.desc().nulls_last())
        .limit(100)
    )
    return [SocialPostResponse.model_validate(r) for r in result.scalars().all()]


@router.post("/refresh", response_model=List[SocialPostResponse])
async def refresh_posts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    integ = await db.execute(
        select(Integration).where(
            Integration.tenant_id == current_user.tenant_id,
            Integration.provider == "instagram_dm",
        )
    )
    row = integ.scalar_one_or_none()
    if not row or not row.credentials_encrypted:
        raise HTTPException(
            status_code=400,
            detail="Instagram is not connected. Visit /social/connect first.",
        )
    creds = decrypt_json(row.credentials_encrypted)
    token = creds.get("access_token")
    ig_id = creds.get("instagram_business_id")
    if not token or not ig_id:
        raise HTTPException(status_code=500, detail="Instagram credentials malformed")

    url = f"https://graph.facebook.com/v19.0/{ig_id}/media"
    params = {
        "fields": "id,caption,media_url,permalink,timestamp",
        "access_token": token,
        "limit": 25,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Meta API error: {exc}")
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Meta API returned {resp.status_code}: {resp.text[:200]}",
        )
    items = (resp.json() or {}).get("data", [])

    upserted: list[SocialPost] = []
    for it in items:
        ext_id = str(it.get("id") or "")
        if not ext_id:
            continue
        existing_q = await db.execute(
            select(SocialPost).where(
                SocialPost.tenant_id == current_user.tenant_id,
                SocialPost.platform == "instagram",
                SocialPost.external_post_id == ext_id,
            )
        )
        post = existing_q.scalar_one_or_none()
        if post is None:
            post = SocialPost(
                tenant_id=current_user.tenant_id,
                platform="instagram",
                external_post_id=ext_id,
                permalink=it.get("permalink"),
                caption=it.get("caption"),
                media_url=it.get("media_url"),
            )
            db.add(post)
        else:
            post.permalink = it.get("permalink") or post.permalink
            post.caption = it.get("caption") or post.caption
            post.media_url = it.get("media_url") or post.media_url
        ts = it.get("timestamp")
        if ts:
            try:
                post.posted_at = datetime.fromisoformat(ts.replace("+0000", "+00:00"))
            except Exception:  # noqa: BLE001
                pass
        upserted.append(post)
    await db.flush()
    return [SocialPostResponse.model_validate(p) for p in upserted]
