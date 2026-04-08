"""Outreach log routes: list, detail, and event tracking."""

from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.dependencies import get_db, get_current_user
from models.outreach_log import OutreachLog
from models.user import User

router = APIRouter(prefix="/outreach", tags=["outreach"])


class OutreachLogResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    campaign_id: Optional[UUID] = None
    step_id: Optional[UUID] = None
    lead_id: Optional[UUID] = None
    channel: str
    recipient: str
    status: str
    sent_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None
    error_msg: Optional[str] = None
    message_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TrackEventRequest(BaseModel):
    message_id: str
    event: str  # "open", "click", "reply", "bounce"
    timestamp: Optional[datetime] = None


@router.get("/", response_model=List[OutreachLogResponse])
async def list_outreach_logs(
    campaign_id: Optional[UUID] = Query(None),
    lead_id: Optional[UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List outreach logs with optional filtering."""
    query = select(OutreachLog).where(
        OutreachLog.tenant_id == current_user.tenant_id
    )

    if campaign_id:
        query = query.where(OutreachLog.campaign_id == campaign_id)
    if lead_id:
        query = query.where(OutreachLog.lead_id == lead_id)
    if status_filter:
        query = query.where(OutreachLog.status == status_filter)

    offset = (page - 1) * per_page
    query = query.order_by(OutreachLog.created_at.desc()).offset(offset).limit(per_page)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{log_id}", response_model=OutreachLogResponse)
async def get_outreach_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single outreach log entry."""
    result = await db.execute(
        select(OutreachLog).where(
            OutreachLog.id == log_id,
            OutreachLog.tenant_id == current_user.tenant_id,
        )
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Outreach log not found",
        )
    return log


@router.post("/track-event", status_code=status.HTTP_200_OK)
async def track_event(
    body: TrackEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Webhook-style endpoint to track opens, clicks, replies on outreach logs."""
    result = await db.execute(
        select(OutreachLog).where(
            OutreachLog.message_id == body.message_id,
            OutreachLog.tenant_id == current_user.tenant_id,
        )
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Outreach log not found for this message_id",
        )

    ts = body.timestamp or datetime.now(timezone.utc)

    if body.event == "open" and not log.opened_at:
        log.opened_at = ts
    elif body.event == "click" and not log.clicked_at:
        log.clicked_at = ts
        if not log.opened_at:
            log.opened_at = ts
    elif body.event == "reply" and not log.replied_at:
        log.replied_at = ts
        if not log.opened_at:
            log.opened_at = ts
    elif body.event == "bounce":
        log.status = "bounced"
        log.error_msg = "Email bounced"

    await db.flush()
    return {"detail": f"Event '{body.event}' tracked", "message_id": body.message_id}
