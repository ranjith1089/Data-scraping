"""Pipeline stages and deals routes for kanban board."""

from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.dependencies import get_db, get_current_user
from models.pipeline_stage import PipelineStage
from models.deal import Deal
from models.user import User
from schemas.pipeline import (
    PipelineStageCreate,
    PipelineStageUpdate,
    PipelineStageResponse,
    DealCreate,
    DealUpdate,
    DealResponse,
)

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


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
