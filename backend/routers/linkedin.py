"""LinkedIn Prospecting router — Phase 4.

POST /api/v1/linkedin/leads/{lead_id}/enrich            — enrich via ProxyCurl
POST /api/v1/linkedin/leads/{lead_id}/messages/generate  — AI generate messages
GET  /api/v1/linkedin/leads/{lead_id}/messages           — list messages for lead
GET  /api/v1/linkedin/messages                           — list all (filterable)
PATCH /api/v1/linkedin/messages/{message_id}             — update (text, status, timestamps)
DELETE /api/v1/linkedin/messages/{message_id}            — delete (204)
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from models.lead import Lead
from models.linkedin_message import LinkedInMessage
from models.user import User
from schemas.linkedin import (
    GenerateLinkedInMessageRequest,
    LinkedInEnrichResponse,
    LinkedInMessageResponse,
    UpdateLinkedInMessageRequest,
)
from services import linkedin_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/linkedin", tags=["linkedin"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_lead_or_404(lead_id: UUID, db: AsyncSession, tenant_id: UUID) -> Lead:
    row = (
        await db.execute(
            select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Lead not found")
    return row


def _enrich_response(msg: LinkedInMessage, lead: Lead) -> LinkedInMessageResponse:
    """Attach lead fields onto the message response."""
    resp = LinkedInMessageResponse.model_validate(msg)
    resp.lead_company = lead.company_name
    resp.lead_contact = lead.contact_name
    resp.lead_linkedin_url = lead.linkedin_url
    resp.lead_designation = lead.designation
    resp.lead_sector_code = lead.sector_code
    return resp


# ---------------------------------------------------------------------------
# Enrich
# ---------------------------------------------------------------------------


@router.post("/leads/{lead_id}/enrich", response_model=LinkedInEnrichResponse)
async def enrich_lead_linkedin(
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch the lead's LinkedIn profile via ProxyCurl and store the snapshot.

    Always returns a result (even if API key missing); check ``source`` and
    ``warning`` fields to understand the outcome.
    """
    lead = await _get_lead_or_404(lead_id, db, current_user.tenant_id)

    profile = await linkedin_service.enrich_profile(lead.linkedin_url or "")

    # Persist snapshot back onto any existing messages for this lead
    if profile.get("source") == "proxycurl":
        await db.execute(
            update(LinkedInMessage)
            .where(
                LinkedInMessage.lead_id == lead_id,
                LinkedInMessage.tenant_id == current_user.tenant_id,
            )
            .values(
                linkedin_headline=profile.get("headline"),
                linkedin_summary=profile.get("summary"),
                linkedin_profile_snapshot=profile,
                updated_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()

    return LinkedInEnrichResponse(
        headline=profile.get("headline"),
        summary=profile.get("summary"),
        skills=profile.get("skills", []),
        location=profile.get("location"),
        follower_count=profile.get("follower_count"),
        connections=profile.get("connections"),
        source=profile.get("source", "error"),
        warning=profile.get("warning"),
    )


# ---------------------------------------------------------------------------
# Generate messages
# ---------------------------------------------------------------------------


@router.post(
    "/leads/{lead_id}/messages/generate",
    response_model=LinkedInMessageResponse,
    status_code=201,
)
async def generate_messages(
    lead_id: UUID,
    req: GenerateLinkedInMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI-generate a LinkedIn connection note (≤300 chars) + optional follow-up
    for the given lead, save the result, and return it.
    """
    lead = await _get_lead_or_404(lead_id, db, current_user.tenant_id)

    # Pull any previously enriched profile data from existing messages
    latest_snapshot: dict = {}
    existing_msg = (
        await db.execute(
            select(LinkedInMessage)
            .where(
                LinkedInMessage.lead_id == lead_id,
                LinkedInMessage.tenant_id == current_user.tenant_id,
                LinkedInMessage.linkedin_profile_snapshot.isnot(None),
            )
            .order_by(LinkedInMessage.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if existing_msg and existing_msg.linkedin_profile_snapshot:
        latest_snapshot = existing_msg.linkedin_profile_snapshot

    generated = await linkedin_service.generate_messages(
        lead_name=lead.contact_name or lead.company_name,
        lead_company=lead.company_name,
        lead_designation=lead.designation,
        lead_sector=lead.sector_code or "it_ites",
        linkedin_headline=latest_snapshot.get("headline") or lead.linkedin_url,
        linkedin_summary=latest_snapshot.get("summary"),
        skills=latest_snapshot.get("skills", []),
        tone=req.tone,
        context=req.context,
        include_followup=req.include_followup,
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        lead_id=lead_id,
    )

    msg = LinkedInMessage(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        lead_id=lead_id,
        created_by=current_user.id,
        connection_note=generated["connection_note"],
        followup_message=generated.get("followup_message"),
        status="draft",
        ai_generated=True,
        ai_tone=req.tone,
        linkedin_headline=latest_snapshot.get("headline"),
        linkedin_summary=latest_snapshot.get("summary"),
        linkedin_profile_snapshot=latest_snapshot or None,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    return _enrich_response(msg, lead)


# ---------------------------------------------------------------------------
# List messages for a lead
# ---------------------------------------------------------------------------


@router.get("/leads/{lead_id}/messages", response_model=List[LinkedInMessageResponse])
async def list_lead_messages(
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = await _get_lead_or_404(lead_id, db, current_user.tenant_id)

    rows = (
        await db.execute(
            select(LinkedInMessage)
            .where(
                LinkedInMessage.lead_id == lead_id,
                LinkedInMessage.tenant_id == current_user.tenant_id,
            )
            .order_by(LinkedInMessage.created_at.desc())
        )
    ).scalars().all()

    return [_enrich_response(m, lead) for m in rows]


# ---------------------------------------------------------------------------
# List all messages (global view with optional filters)
# ---------------------------------------------------------------------------


@router.get("/messages", response_model=List[LinkedInMessageResponse])
async def list_all_messages(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        select(LinkedInMessage, Lead)
        .join(Lead, LinkedInMessage.lead_id == Lead.id)
        .where(LinkedInMessage.tenant_id == current_user.tenant_id)
    )
    if status:
        q = q.where(LinkedInMessage.status == status)
    q = q.order_by(LinkedInMessage.updated_at.desc()).limit(limit).offset(offset)

    rows = (await db.execute(q)).all()
    results = []
    for msg, lead in rows:
        results.append(_enrich_response(msg, lead))
    return results


# ---------------------------------------------------------------------------
# Update a message
# ---------------------------------------------------------------------------


@router.patch("/messages/{message_id}", response_model=LinkedInMessageResponse)
async def update_message(
    message_id: UUID,
    req: UpdateLinkedInMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = (
        await db.execute(
            select(LinkedInMessage).where(
                LinkedInMessage.id == message_id,
                LinkedInMessage.tenant_id == current_user.tenant_id,
            )
        )
    ).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Message not found")

    updates = req.model_dump(exclude_none=True)
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        for k, v in updates.items():
            setattr(msg, k, v)
        await db.commit()
        await db.refresh(msg)

    lead = await _get_lead_or_404(msg.lead_id, db, current_user.tenant_id)
    return _enrich_response(msg, lead)


# ---------------------------------------------------------------------------
# Delete a message
# ---------------------------------------------------------------------------


@router.delete("/messages/{message_id}", status_code=204)
async def delete_message(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = (
        await db.execute(
            select(LinkedInMessage).where(
                LinkedInMessage.id == message_id,
                LinkedInMessage.tenant_id == current_user.tenant_id,
            )
        )
    ).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Message not found")

    await db.delete(msg)
    await db.commit()
