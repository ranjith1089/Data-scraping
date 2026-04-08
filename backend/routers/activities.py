"""Activity log routes."""

from uuid import UUID
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.dependencies import get_db, get_current_user
from models.activity import Activity
from models.user import User
from schemas.activity import (
    ActivityCreate,
    ActivityUpdate,
    ActivityResponse,
    ActivityType,
)

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("/", response_model=List[ActivityResponse])
async def list_activities(
    lead_id: Optional[UUID] = Query(None),
    user_id: Optional[UUID] = Query(None),
    type: Optional[ActivityType] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List activities with optional filters and pagination."""
    query = select(Activity).where(Activity.tenant_id == current_user.tenant_id)

    if lead_id:
        query = query.where(Activity.lead_id == lead_id)
    if user_id:
        query = query.where(Activity.user_id == user_id)
    if type:
        query = query.where(Activity.type == type.value)

    offset = (page - 1) * per_page
    query = query.order_by(Activity.created_at.desc()).offset(offset).limit(per_page)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
async def create_activity(
    body: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new activity."""
    activity = Activity(
        tenant_id=current_user.tenant_id,
        lead_id=body.lead_id,
        user_id=current_user.id,
        type=body.type.value,
        note=body.note,
        outcome=body.outcome.value if body.outcome else None,
        next_action=body.next_action,
        next_action_at=body.next_action_at,
    )
    db.add(activity)
    await db.flush()
    return activity


@router.get("/{activity_id}", response_model=ActivityResponse)
async def get_activity(
    activity_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single activity."""
    result = await db.execute(
        select(Activity).where(
            Activity.id == activity_id,
            Activity.tenant_id == current_user.tenant_id,
        )
    )
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Activity not found",
        )
    return activity
