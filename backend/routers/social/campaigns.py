"""CRUD + results for SocialCampaign rows.

A SocialCampaign is the user-facing grouping that bundles N posts
with M automation rules. Pausing the campaign disables all linked
rules (handled here).
"""

from __future__ import annotations

import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from models.automation_rule import AutomationRule
from models.social.social_campaign import SocialCampaign, SocialCampaignPost
from models.social.social_message import SocialMessage
from models.social.social_post import SocialPost
from models.user import User
from schemas.social.campaigns import (
    SocialCampaignCreate,
    SocialCampaignResponse,
    SocialCampaignResults,
    SocialCampaignUpdate,
    SocialPostResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social/campaigns", tags=["social-campaigns"])


async def _attached_posts(
    db: AsyncSession, campaign_id: UUID
) -> List[SocialPost]:
    result = await db.execute(
        select(SocialPost)
        .join(
            SocialCampaignPost,
            SocialCampaignPost.post_id == SocialPost.id,
        )
        .where(SocialCampaignPost.campaign_id == campaign_id)
    )
    return list(result.scalars().all())


async def _rule_count(db: AsyncSession, campaign_id: UUID) -> int:
    return (
        await db.scalar(
            select(func.count(AutomationRule.id)).where(
                AutomationRule.campaign_id == campaign_id
            )
        )
        or 0
    )


async def _serialise(
    db: AsyncSession, row: SocialCampaign
) -> SocialCampaignResponse:
    posts = await _attached_posts(db, row.id)
    return SocialCampaignResponse(
        id=row.id,
        name=row.name,
        status=row.status,
        goal=row.goal,
        posts=[SocialPostResponse.model_validate(p) for p in posts],
        rule_count=await _rule_count(db, row.id),
        created_at=row.created_at,
    )


@router.get("/", response_model=List[SocialCampaignResponse])
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SocialCampaign)
        .where(SocialCampaign.tenant_id == current_user.tenant_id)
        .order_by(SocialCampaign.created_at.desc())
    )
    rows = result.scalars().all()
    return [await _serialise(db, r) for r in rows]


@router.post(
    "/", response_model=SocialCampaignResponse, status_code=status.HTTP_201_CREATED
)
async def create_campaign(
    body: SocialCampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = SocialCampaign(
        tenant_id=current_user.tenant_id,
        name=body.name.strip(),
        goal=body.goal,
        created_by=current_user.id,
    )
    db.add(row)
    await db.flush()
    for pid in body.post_ids:
        # Validate post belongs to tenant before attaching.
        post = await db.get(SocialPost, pid)
        if not post or post.tenant_id != current_user.tenant_id:
            continue
        db.add(SocialCampaignPost(campaign_id=row.id, post_id=pid))
    await db.flush()
    return await _serialise(db, row)


@router.get("/{campaign_id}", response_model=SocialCampaignResponse)
async def get_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.get(SocialCampaign, campaign_id)
    if not row or row.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return await _serialise(db, row)


@router.patch("/{campaign_id}", response_model=SocialCampaignResponse)
async def update_campaign(
    campaign_id: UUID,
    body: SocialCampaignUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.get(SocialCampaign, campaign_id)
    if not row or row.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Campaign not found")

    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        row.name = data["name"]
    if "goal" in data:
        row.goal = data["goal"]
    if "status" in data and data["status"]:
        row.status = data["status"]
        # Cascade pause/archive to linked rules.
        if data["status"] in ("paused", "archived"):
            await db.execute(
                update(AutomationRule)
                .where(AutomationRule.campaign_id == row.id)
                .values(enabled=False)
            )
        elif data["status"] == "active":
            await db.execute(
                update(AutomationRule)
                .where(AutomationRule.campaign_id == row.id)
                .values(enabled=True)
            )
    if "post_ids" in data and data["post_ids"] is not None:
        # Replace the post set.
        await db.execute(
            SocialCampaignPost.__table__.delete().where(
                SocialCampaignPost.campaign_id == row.id
            )
        )
        for pid in data["post_ids"]:
            post = await db.get(SocialPost, pid)
            if not post or post.tenant_id != current_user.tenant_id:
                continue
            db.add(SocialCampaignPost(campaign_id=row.id, post_id=pid))
    await db.flush()
    return await _serialise(db, row)


@router.delete("/{campaign_id}", status_code=status.HTTP_200_OK)
async def delete_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.get(SocialCampaign, campaign_id)
    if not row or row.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await db.delete(row)
    return {"detail": "Campaign deleted", "id": str(campaign_id)}


@router.get("/{campaign_id}/results", response_model=SocialCampaignResults)
async def campaign_results(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.get(SocialCampaign, campaign_id)
    if not row or row.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # All rule_ids in this campaign.
    rules_q = await db.execute(
        select(AutomationRule.id).where(AutomationRule.campaign_id == campaign_id)
    )
    rule_ids = [r for r in rules_q.scalars().all()]

    if not rule_ids:
        return SocialCampaignResults(
            campaign_id=campaign_id,
            dms_sent=0,
            leads_created=0,
            conversion_rate=0.0,
            avg_response_time_seconds=None,
        )

    sent = (
        await db.scalar(
            select(func.count(SocialMessage.id)).where(
                SocialMessage.tenant_id == current_user.tenant_id,
                SocialMessage.rule_id.in_(rule_ids),
                SocialMessage.direction == "outbound",
                SocialMessage.status.in_(["sent", "delivered"]),
            )
        )
        or 0
    )
    # Leads attributed via the rule fan-out land in `leads` with
    # `source='instagram'` and `custom_fields.source_post_id` matching
    # one of the campaign's posts. For Phase 1 we approximate with a
    # cheaper count over outbound messages whose rule is in this set,
    # since lead creation is downstream of the same fan-out.
    return SocialCampaignResults(
        campaign_id=campaign_id,
        dms_sent=sent,
        leads_created=sent,  # approximation — refined in commit 6
        conversion_rate=0.0,  # filled by analytics router which knows the funnel
        avg_response_time_seconds=None,
    )
