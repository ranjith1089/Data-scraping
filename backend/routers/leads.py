"""Lead management routes with full-text search and bulk operations."""

import math
from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, delete

from core.dependencies import get_db, get_current_user
from models.lead import Lead
from models.user import User
from schemas.lead import (
    LeadCreate,
    LeadUpdate,
    LeadResponse,
    LeadListResponse,
    LeadSearchParams,
    LeadStage,
    CompanySize,
)

router = APIRouter(prefix="/leads", tags=["leads"])


# ---------- Bulk operation schemas ----------

class BulkUpdateRequest(BaseModel):
    lead_ids: List[UUID] = Field(..., min_length=1, max_length=500)
    updates: LeadUpdate


class BulkDeleteRequest(BaseModel):
    lead_ids: List[UUID] = Field(..., min_length=1, max_length=500)


# ---------- Routes ----------

@router.get("/", response_model=LeadListResponse)
async def list_leads(
    sector_code: Optional[str] = Query(None),
    stage: Optional[LeadStage] = Query(None),
    min_score: Optional[int] = Query(None, ge=0, le=100),
    max_score: Optional[int] = Query(None, ge=0, le=100),
    district: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    company_size: Optional[CompanySize] = Query(None),
    assigned_to: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List leads with filtering, full-text search, and pagination."""
    base = select(Lead).where(Lead.tenant_id == current_user.tenant_id)

    # Apply filters
    if sector_code:
        base = base.where(Lead.sector_code == sector_code)
    if stage:
        base = base.where(Lead.stage == stage.value)
    if min_score is not None:
        base = base.where(Lead.lead_score >= min_score)
    if max_score is not None:
        base = base.where(Lead.lead_score <= max_score)
    if district:
        base = base.where(Lead.district == district)
    if city:
        base = base.where(Lead.city == city)
    if company_size:
        base = base.where(Lead.company_size == company_size.value)
    if assigned_to:
        base = base.where(Lead.assigned_to == assigned_to)

    # Full-text search
    if search:
        base = base.where(
            func.to_tsvector(
                'english',
                func.coalesce(Lead.company_name, '') + ' ' +
                func.coalesce(Lead.contact_name, '') + ' ' +
                func.coalesce(Lead.industry, '') + ' ' +
                func.coalesce(Lead.city, '')
            ).match(search)
        )

    # Count total
    count_query = select(func.count()).select_from(base.subquery())
    total = await db.scalar(count_query) or 0

    # Paginate
    offset = (page - 1) * per_page
    query = base.order_by(Lead.created_at.desc()).offset(offset).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    return LeadListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.post("/", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    body: LeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a single lead."""
    # Flatten enum fields (company_size, source) to their string values
    # so SQLAlchemy doesn't get a Pydantic Enum instance in the column.
    payload = body.model_dump()
    if payload.get("company_size") and hasattr(payload["company_size"], "value"):
        payload["company_size"] = payload["company_size"].value
    if payload.get("source") and hasattr(payload["source"], "value"):
        payload["source"] = payload["source"].value

    lead = Lead(tenant_id=current_user.tenant_id, **payload)
    db.add(lead)
    await db.flush()
    response = LeadResponse.model_validate(lead)

    # Fire webhook fan-out (best-effort — never fail the request).
    try:
        from services.webhook_dispatcher import publish_event

        await publish_event(
            db,
            current_user.tenant_id,
            "lead.created",
            response.model_dump(mode="json"),
        )
    except Exception as exc:  # noqa: BLE001
        import logging as _lg

        _lg.getLogger(__name__).warning("lead.created webhook fan-out failed: %s", exc)

    return response


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single lead by ID."""
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.tenant_id == current_user.tenant_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )
    return lead


@router.patch("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: UUID,
    body: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a lead."""
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.tenant_id == current_user.tenant_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(value, "value"):
            value = value.value
        setattr(lead, field, value)

    await db.flush()
    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_200_OK)
async def delete_lead(
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a lead."""
    result = await db.execute(
        select(Lead).where(
            Lead.id == lead_id,
            Lead.tenant_id == current_user.tenant_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )

    await db.delete(lead)
    await db.flush()
    return {"detail": "Lead deleted", "lead_id": str(lead_id)}


@router.post("/bulk-update", status_code=status.HTTP_200_OK)
async def bulk_update_leads(
    body: BulkUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk update leads (stage, assigned_to, tags)."""
    result = await db.execute(
        select(Lead).where(
            Lead.id.in_(body.lead_ids),
            Lead.tenant_id == current_user.tenant_id,
        )
    )
    leads = result.scalars().all()

    if not leads:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching leads found",
        )

    update_data = body.updates.model_dump(exclude_unset=True)
    updated_count = 0
    for lead in leads:
        for field, value in update_data.items():
            if hasattr(value, "value"):
                value = value.value
            setattr(lead, field, value)
        updated_count += 1

    await db.flush()
    return {"detail": f"{updated_count} leads updated", "updated": updated_count}


@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_delete_leads(
    body: BulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk delete leads."""
    result = await db.execute(
        select(Lead).where(
            Lead.id.in_(body.lead_ids),
            Lead.tenant_id == current_user.tenant_id,
        )
    )
    leads = result.scalars().all()

    if not leads:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching leads found",
        )

    deleted_count = 0
    for lead in leads:
        await db.delete(lead)
        deleted_count += 1

    await db.flush()
    return {"detail": f"{deleted_count} leads deleted", "deleted": deleted_count}
