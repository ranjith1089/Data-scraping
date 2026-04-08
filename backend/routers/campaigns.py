"""Campaign management and execution routes."""

from uuid import UUID
from typing import List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.dependencies import get_db, get_current_user
from models.campaign import Campaign
from models.campaign_step import CampaignStep
from models.outreach_log import OutreachLog
from models.user import User
from schemas.campaign import (
    CampaignCreate,
    CampaignUpdate,
    CampaignResponse,
    CampaignStepCreate,
    CampaignStepResponse,
)
from services.campaign_runner import campaign_runner

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


async def _enrich_campaign(db: AsyncSession, campaign: Campaign) -> dict:
    """Add computed stats to a campaign response."""
    sent = await db.scalar(
        select(func.count(OutreachLog.id)).where(
            OutreachLog.campaign_id == campaign.id,
            OutreachLog.status == "sent",
        )
    ) or 0
    opened = await db.scalar(
        select(func.count(OutreachLog.id)).where(
            OutreachLog.campaign_id == campaign.id,
            OutreachLog.opened_at.isnot(None),
        )
    ) or 0
    replied = await db.scalar(
        select(func.count(OutreachLog.id)).where(
            OutreachLog.campaign_id == campaign.id,
            OutreachLog.replied_at.isnot(None),
        )
    ) or 0

    return CampaignResponse(
        id=campaign.id,
        tenant_id=campaign.tenant_id,
        name=campaign.name,
        status=campaign.status,
        sector_codes=campaign.sector_codes or [],
        channel=campaign.channel,
        segment_filter=campaign.segment_filter,
        daily_limit=campaign.daily_limit,
        ai_tone=campaign.ai_tone,
        sent_count=sent,
        open_count=opened,
        reply_count=replied,
        created_at=campaign.created_at,
    )


@router.get("/", response_model=List[CampaignResponse])
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all campaigns for the current tenant."""
    result = await db.execute(
        select(Campaign)
        .where(Campaign.tenant_id == current_user.tenant_id)
        .order_by(Campaign.created_at.desc())
    )
    campaigns = result.scalars().all()
    return [await _enrich_campaign(db, c) for c in campaigns]


@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    body: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new campaign."""
    campaign = Campaign(
        tenant_id=current_user.tenant_id,
        name=body.name,
        sector_codes=body.sector_codes,
        channel=body.channel.value,
        segment_filter=body.segment_filter,
        daily_limit=body.daily_limit,
        ai_tone=body.ai_tone,
        created_by=current_user.id,
    )
    db.add(campaign)
    await db.flush()
    return await _enrich_campaign(db, campaign)


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a campaign with its steps."""
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.tenant_id == current_user.tenant_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return await _enrich_campaign(db, campaign)


@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: UUID,
    body: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a campaign."""
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.tenant_id == current_user.tenant_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(value, "value"):
            value = value.value
        setattr(campaign, field, value)

    await db.flush()
    return await _enrich_campaign(db, campaign)


@router.delete("/{campaign_id}", status_code=status.HTTP_200_OK)
async def delete_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a campaign and its steps."""
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.tenant_id == current_user.tenant_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    await db.delete(campaign)
    await db.flush()
    return {"detail": "Campaign deleted", "campaign_id": str(campaign_id)}


@router.post("/{campaign_id}/start", response_model=CampaignResponse)
async def start_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start (activate) a campaign."""
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.tenant_id == current_user.tenant_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    if campaign.status not in ("draft", "paused"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start campaign in '{campaign.status}' status",
        )

    campaign.status = "active"
    campaign.started_at = datetime.now(timezone.utc)
    await db.flush()
    return await _enrich_campaign(db, campaign)


@router.post("/{campaign_id}/pause", response_model=CampaignResponse)
async def pause_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pause an active campaign."""
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.tenant_id == current_user.tenant_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    if campaign.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only active campaigns can be paused",
        )

    campaign.status = "paused"
    await db.flush()
    return await _enrich_campaign(db, campaign)


@router.post("/{campaign_id}/execute-step/{step_id}")
async def execute_campaign_step(
    campaign_id: UUID,
    step_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Execute a specific campaign step (send outreach)."""
    # Verify campaign belongs to tenant
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.tenant_id == current_user.tenant_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    # Verify step belongs to campaign
    step_result = await db.execute(
        select(CampaignStep).where(
            CampaignStep.id == step_id,
            CampaignStep.campaign_id == campaign_id,
        )
    )
    step = step_result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign step not found")

    execution_result = await campaign_runner.execute_step(
        db=db,
        campaign_id=campaign_id,
        step_id=step_id,
        tenant_id=current_user.tenant_id,
    )

    if "error" in execution_result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=execution_result["error"],
        )

    return execution_result


@router.get("/{campaign_id}/stats")
async def get_campaign_stats(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed outreach stats for a campaign."""
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id,
            Campaign.tenant_id == current_user.tenant_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    total = await db.scalar(
        select(func.count(OutreachLog.id)).where(OutreachLog.campaign_id == campaign_id)
    ) or 0
    sent = await db.scalar(
        select(func.count(OutreachLog.id)).where(
            OutreachLog.campaign_id == campaign_id,
            OutreachLog.status == "sent",
        )
    ) or 0
    opened = await db.scalar(
        select(func.count(OutreachLog.id)).where(
            OutreachLog.campaign_id == campaign_id,
            OutreachLog.opened_at.isnot(None),
        )
    ) or 0
    clicked = await db.scalar(
        select(func.count(OutreachLog.id)).where(
            OutreachLog.campaign_id == campaign_id,
            OutreachLog.clicked_at.isnot(None),
        )
    ) or 0
    replied = await db.scalar(
        select(func.count(OutreachLog.id)).where(
            OutreachLog.campaign_id == campaign_id,
            OutreachLog.replied_at.isnot(None),
        )
    ) or 0
    failed = await db.scalar(
        select(func.count(OutreachLog.id)).where(
            OutreachLog.campaign_id == campaign_id,
            OutreachLog.status == "failed",
        )
    ) or 0

    # Per-step breakdown
    steps_result = await db.execute(
        select(CampaignStep)
        .where(CampaignStep.campaign_id == campaign_id)
        .order_by(CampaignStep.step_number)
    )
    steps = steps_result.scalars().all()

    step_stats = []
    for s in steps:
        s_sent = await db.scalar(
            select(func.count(OutreachLog.id)).where(
                OutreachLog.step_id == s.id, OutreachLog.status == "sent"
            )
        ) or 0
        s_opened = await db.scalar(
            select(func.count(OutreachLog.id)).where(
                OutreachLog.step_id == s.id, OutreachLog.opened_at.isnot(None)
            )
        ) or 0
        s_replied = await db.scalar(
            select(func.count(OutreachLog.id)).where(
                OutreachLog.step_id == s.id, OutreachLog.replied_at.isnot(None)
            )
        ) or 0
        step_stats.append({
            "step_id": str(s.id),
            "step_number": s.step_number,
            "channel": s.channel,
            "sent": s_sent,
            "opened": s_opened,
            "replied": s_replied,
            "open_rate": round(s_opened / s_sent * 100, 1) if s_sent > 0 else 0,
        })

    return {
        "campaign_id": str(campaign_id),
        "campaign_name": campaign.name,
        "status": campaign.status,
        "total_outreach": total,
        "sent": sent,
        "opened": opened,
        "clicked": clicked,
        "replied": replied,
        "failed": failed,
        "open_rate": round(opened / sent * 100, 1) if sent > 0 else 0,
        "click_rate": round(clicked / sent * 100, 1) if sent > 0 else 0,
        "reply_rate": round(replied / sent * 100, 1) if sent > 0 else 0,
        "steps": step_stats,
    }
