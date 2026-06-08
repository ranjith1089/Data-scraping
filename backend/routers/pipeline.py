"""Pipeline stages and deals routes for kanban board."""

from uuid import UUID
from typing import List, Optional
import uuid as _uuid
from datetime import datetime, timezone, date as _date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from core.dependencies import get_db, get_current_user
from models.pipeline_stage import PipelineStage
from models.deal import Deal
from models.deal_activity import DealActivity
from models.lead import Lead
from models.user import User
from schemas.pipeline import (
    PipelineStageCreate,
    PipelineStageUpdate,
    PipelineStageResponse,
    DealCreate,
    DealUpdate,
    DealResponse,
    MarkWonRequest,
    MarkLostRequest,
    DealActivityCreate,
    DealActivityResponse,
    RevenueForecast,
)

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


# ─── helpers ─────────────────────────────────────────────────────────────────

async def _enrich_deal(deal: Deal, db: AsyncSession) -> DealResponse:
    r = DealResponse.model_validate(deal)
    if deal.lead_id:
        lead = await db.get(Lead, deal.lead_id)
        if lead:
            r.lead_company = lead.company_name
            r.lead_contact = lead.contact_name
    if deal.stage_id:
        stage = await db.get(PipelineStage, deal.stage_id)
        if stage:
            r.stage_name = stage.name
    return r


# ============ STAGES ============

@router.get("/stages", response_model=List[PipelineStageResponse])
async def list_stages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List pipeline stages ordered by order_index."""
    result = await db.execute(
        select(PipelineStage)
        .where(PipelineStage.tenant_id == current_user.tenant_id)
        .order_by(PipelineStage.order_index)
    )
    stages = result.scalars().all()

    enriched = []
    for stage in stages:
        deal_count = await db.scalar(
            select(func.count(Deal.id)).where(
                Deal.stage_id == stage.id,
                Deal.tenant_id == current_user.tenant_id,
            )
        ) or 0
        total_value = await db.scalar(
            select(func.coalesce(func.sum(Deal.value_inr), 0)).where(
                Deal.stage_id == stage.id,
                Deal.tenant_id == current_user.tenant_id,
            )
        ) or 0
        enriched.append(PipelineStageResponse(
            id=stage.id,
            tenant_id=stage.tenant_id,
            name=stage.name,
            order_index=stage.order_index,
            color=stage.color,
            is_default=stage.is_default,
            deal_count=deal_count,
            total_value_inr=float(total_value),
            created_at=stage.created_at,
        ))

    return enriched


@router.post("/stages", response_model=PipelineStageResponse, status_code=status.HTTP_201_CREATED)
async def create_stage(
    body: PipelineStageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new pipeline stage."""
    stage = PipelineStage(
        tenant_id=current_user.tenant_id,
        name=body.name,
        order_index=body.order_index,
        color=body.color,
        is_default=body.is_default,
    )
    db.add(stage)
    await db.flush()

    return PipelineStageResponse(
        id=stage.id,
        tenant_id=stage.tenant_id,
        name=stage.name,
        order_index=stage.order_index,
        color=stage.color,
        is_default=stage.is_default,
        deal_count=0,
        total_value_inr=0,
        created_at=stage.created_at,
    )


@router.patch("/stages/{stage_id}", response_model=PipelineStageResponse)
async def update_stage(
    stage_id: UUID,
    body: PipelineStageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a pipeline stage."""
    result = await db.execute(
        select(PipelineStage).where(
            PipelineStage.id == stage_id,
            PipelineStage.tenant_id == current_user.tenant_id,
        )
    )
    stage = result.scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stage not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(stage, field, value)
    await db.flush()

    deal_count = await db.scalar(
        select(func.count(Deal.id)).where(Deal.stage_id == stage.id)
    ) or 0
    total_value = await db.scalar(
        select(func.coalesce(func.sum(Deal.value_inr), 0)).where(Deal.stage_id == stage.id)
    ) or 0

    return PipelineStageResponse(
        id=stage.id,
        tenant_id=stage.tenant_id,
        name=stage.name,
        order_index=stage.order_index,
        color=stage.color,
        is_default=stage.is_default,
        deal_count=deal_count,
        total_value_inr=float(total_value),
        created_at=stage.created_at,
    )


@router.delete("/stages/{stage_id}", status_code=status.HTTP_200_OK)
async def delete_stage(
    stage_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a pipeline stage. Fails if deals still reference it."""
    result = await db.execute(
        select(PipelineStage).where(
            PipelineStage.id == stage_id,
            PipelineStage.tenant_id == current_user.tenant_id,
        )
    )
    stage = result.scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stage not found")

    deal_count = await db.scalar(
        select(func.count(Deal.id)).where(Deal.stage_id == stage_id)
    ) or 0
    if deal_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete stage with {deal_count} active deals. Move them first.",
        )

    await db.delete(stage)
    await db.flush()
    return {"detail": "Stage deleted", "stage_id": str(stage_id)}


# ============ DEALS ============

@router.get("/deals", response_model=List[DealResponse])
async def list_deals(
    stage_id: Optional[UUID] = Query(None),
    assigned_to: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List deals with optional filters."""
    query = select(Deal).where(Deal.tenant_id == current_user.tenant_id)

    if stage_id:
        query = query.where(Deal.stage_id == stage_id)
    if assigned_to:
        query = query.where(Deal.assigned_to == assigned_to)

    query = query.order_by(Deal.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/deals", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    body: DealCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new deal."""
    # Verify stage exists
    stage = await db.execute(
        select(PipelineStage).where(
            PipelineStage.id == body.stage_id,
            PipelineStage.tenant_id == current_user.tenant_id,
        )
    )
    if not stage.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pipeline stage not found",
        )

    deal = Deal(
        tenant_id=current_user.tenant_id,
        lead_id=body.lead_id,
        stage_id=body.stage_id,
        title=body.title,
        value_inr=body.value_inr,
        close_date=body.close_date,
        probability=body.probability or 20,
        notes=body.notes,
        assigned_to=body.assigned_to or current_user.id,
    )
    db.add(deal)
    await db.flush()
    return deal


@router.get("/deals/{deal_id}", response_model=DealResponse)
async def get_deal(
    deal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single deal."""
    result = await db.execute(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.tenant_id == current_user.tenant_id,
        )
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    return deal


@router.patch("/deals/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: UUID,
    body: DealUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a deal (including stage change for kanban drag-and-drop)."""
    result = await db.execute(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.tenant_id == current_user.tenant_id,
        )
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    update_data = body.model_dump(exclude_unset=True)

    # If changing stage, verify new stage exists
    if "stage_id" in update_data and update_data["stage_id"]:
        stage_check = await db.execute(
            select(PipelineStage).where(
                PipelineStage.id == update_data["stage_id"],
                PipelineStage.tenant_id == current_user.tenant_id,
            )
        )
        if not stage_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target pipeline stage not found",
            )

    for field, value in update_data.items():
        setattr(deal, field, value)

    await db.flush()
    return deal


@router.delete("/deals/{deal_id}", status_code=status.HTTP_200_OK)
async def delete_deal(
    deal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a deal."""
    result = await db.execute(
        select(Deal).where(
            Deal.id == deal_id,
            Deal.tenant_id == current_user.tenant_id,
        )
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    await db.delete(deal)
    await db.flush()
    return {"detail": "Deal deleted", "deal_id": str(deal_id)}


# ============ WON / LOST ============

async def _get_deal_or_404(deal_id: UUID, tenant_id, db: AsyncSession) -> Deal:
    deal = (
        await db.execute(
            select(Deal).where(Deal.id == deal_id, Deal.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if not deal:
        raise HTTPException(404, "Deal not found")
    return deal


@router.post("/deals/{deal_id}/won", response_model=DealResponse)
async def mark_won(
    deal_id: UUID,
    _body: MarkWonRequest = MarkWonRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a deal as won."""
    deal = await _get_deal_or_404(deal_id, current_user.tenant_id, db)
    now = datetime.now(timezone.utc)
    deal.status = "won"
    deal.won_at = now
    deal.lost_at = None
    deal.lost_reason = None
    # Auto-log activity
    activity = DealActivity(
        id=_uuid.uuid4(),
        deal_id=deal.id,
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        activity_type="note",
        content="🎉 Deal marked as WON",
        occurred_at=now,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(deal)
    return await _enrich_deal(deal, db)


@router.post("/deals/{deal_id}/lost", response_model=DealResponse)
async def mark_lost(
    deal_id: UUID,
    body: MarkLostRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a deal as lost with an optional reason."""
    deal = await _get_deal_or_404(deal_id, current_user.tenant_id, db)
    now = datetime.now(timezone.utc)
    deal.status = "lost"
    deal.lost_at = now
    deal.won_at = None
    deal.lost_reason = body.lost_reason
    reason_note = f"Reason: {body.lost_reason}" if body.lost_reason else "No reason given"
    activity = DealActivity(
        id=_uuid.uuid4(),
        deal_id=deal.id,
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        activity_type="note",
        content=f"❌ Deal marked as LOST. {reason_note}",
        occurred_at=now,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(deal)
    return await _enrich_deal(deal, db)


@router.post("/deals/{deal_id}/reopen", response_model=DealResponse)
async def reopen_deal(
    deal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reopen a won/lost deal back to open."""
    deal = await _get_deal_or_404(deal_id, current_user.tenant_id, db)
    deal.status = "open"
    deal.won_at = None
    deal.lost_at = None
    deal.lost_reason = None
    await db.commit()
    await db.refresh(deal)
    return await _enrich_deal(deal, db)


# ============ DEAL ACTIVITIES ============

@router.get("/deals/{deal_id}/activities", response_model=List[DealActivityResponse])
async def list_activities(
    deal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_deal_or_404(deal_id, current_user.tenant_id, db)
    rows = (
        await db.execute(
            select(DealActivity)
            .where(DealActivity.deal_id == deal_id, DealActivity.tenant_id == current_user.tenant_id)
            .order_by(DealActivity.occurred_at.desc())
        )
    ).scalars().all()
    return rows


@router.post("/deals/{deal_id}/activities", response_model=DealActivityResponse, status_code=201)
async def add_activity(
    deal_id: UUID,
    body: DealActivityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_deal_or_404(deal_id, current_user.tenant_id, db)
    now = datetime.now(timezone.utc)
    activity = DealActivity(
        id=_uuid.uuid4(),
        deal_id=deal_id,
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        activity_type=body.activity_type,
        content=body.content,
        occurred_at=body.occurred_at or now,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


@router.delete("/deals/{deal_id}/activities/{activity_id}", status_code=204)
async def delete_activity(
    deal_id: UUID,
    activity_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    act = (
        await db.execute(
            select(DealActivity).where(
                DealActivity.id == activity_id,
                DealActivity.deal_id == deal_id,
                DealActivity.tenant_id == current_user.tenant_id,
            )
        )
    ).scalar_one_or_none()
    if not act:
        raise HTTPException(404, "Activity not found")
    await db.delete(act)
    await db.commit()


# ============ REVENUE FORECAST ============

@router.get("/revenue", response_model=RevenueForecast)
async def revenue_forecast(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revenue pipeline forecast for the current tenant."""
    tid = current_user.tenant_id
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today = _date.today()
    month_end = _date(today.year, today.month + 1 if today.month < 12 else 1, 1)

    # All open deals
    open_deals = (
        await db.execute(
            select(Deal).where(Deal.tenant_id == tid, Deal.status == "open")
        )
    ).scalars().all()

    total_pipeline = sum(d.value_inr or 0 for d in open_deals)
    weighted = sum((d.value_inr or 0) * (d.probability or 0) / 100 for d in open_deals)

    # Won this month
    won_this_month = (
        await db.execute(
            select(Deal).where(
                Deal.tenant_id == tid,
                Deal.status == "won",
                Deal.won_at >= month_start,
            )
        )
    ).scalars().all()
    won_month_inr = sum(d.value_inr or 0 for d in won_this_month)

    # Counts
    won_count = (await db.scalar(
        select(func.count()).where(Deal.tenant_id == tid, Deal.status == "won")
    )) or 0
    lost_count = (await db.scalar(
        select(func.count()).where(Deal.tenant_id == tid, Deal.status == "lost")
    )) or 0
    open_count = len(open_deals)

    win_rate = round(won_count / (won_count + lost_count) * 100, 1) if (won_count + lost_count) else 0.0

    # Avg deal size (won deals only)
    avg_deal_raw = (await db.scalar(
        select(func.avg(Deal.value_inr)).where(Deal.tenant_id == tid, Deal.status == "won")
    )) or 0
    avg_deal = float(avg_deal_raw)

    # Closing this month
    closing_month = (await db.scalar(
        select(func.count()).where(
            Deal.tenant_id == tid,
            Deal.status == "open",
            Deal.close_date.isnot(None),
            Deal.close_date <= month_end,
        )
    )) or 0

    # Overdue (close_date in the past, still open)
    overdue = (await db.scalar(
        select(func.count()).where(
            Deal.tenant_id == tid,
            Deal.status == "open",
            Deal.close_date.isnot(None),
            Deal.close_date < today,
        )
    )) or 0

    return RevenueForecast(
        total_pipeline_inr=float(total_pipeline),
        weighted_pipeline_inr=round(float(weighted), 0),
        won_this_month_inr=float(won_month_inr),
        won_this_month_count=len(won_this_month),
        open_count=open_count,
        won_count=won_count,
        lost_count=lost_count,
        win_rate=win_rate,
        avg_deal_size_inr=round(avg_deal, 0),
        deals_closing_this_month=closing_month,
        overdue_deals=overdue,
    )


# ============ LEAD DEALS ============

@router.get("/leads/{lead_id}/deals", response_model=List[DealResponse])
async def list_lead_deals(
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all deals for a specific lead."""
    deals = (
        await db.execute(
            select(Deal).where(
                Deal.tenant_id == current_user.tenant_id,
                Deal.lead_id == lead_id,
            ).order_by(Deal.created_at.desc())
        )
    ).scalars().all()
    return [await _enrich_deal(d, db) for d in deals]
