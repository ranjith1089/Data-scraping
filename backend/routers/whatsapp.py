"""WhatsApp Outreach router — Phase 5.

Outreach endpoints (under /api/v1):
  POST /whatsapp/leads/{lead_id}/generate          — AI-generate message (saves to DB)
  POST /whatsapp/leads/{lead_id}/send              — send a message via WhatsApp API
  GET  /whatsapp/leads/{lead_id}/messages          — conversation thread for a lead
  GET  /whatsapp/messages                          — all messages (global view, filterable)
  PATCH /whatsapp/messages/{message_id}            — update status / content
  DELETE /whatsapp/messages/{message_id}           — delete (204)

Webhook endpoints (also under /api/v1):
  GET  /webhooks/whatsapp                          — Meta verification challenge
  POST /webhooks/whatsapp                          — inbound message events from Meta
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.dependencies import get_current_user, get_db
from core.database import AsyncSessionLocal
from models.lead import Lead
from models.whatsapp_message import WhatsAppMessage
from models.user import User
from schemas.whatsapp import (
    GenerateWhatsAppMessageRequest,
    SendWhatsAppMessageRequest,
    SendWhatsAppResult,
    WhatsAppMessageResponse,
)
from services import whatsapp_service as wa_svc
from services import whatsapp_ai_service as wa_ai

logger = logging.getLogger(__name__)

router = APIRouter(tags=["whatsapp"])

# ─── helpers ─────────────────────────────────────────────────────────────────


async def _get_lead_or_404(lead_id: UUID, db: AsyncSession, tenant_id: UUID) -> Lead:
    row = (
        await db.execute(
            select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id)
        )
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Lead not found")
    return row


def _enrich(msg: WhatsAppMessage, lead: Lead) -> WhatsAppMessageResponse:
    resp = WhatsAppMessageResponse.model_validate(msg)
    resp.lead_company = lead.company_name
    resp.lead_contact = lead.contact_name
    resp.lead_phone = lead.phone
    return resp


# ─── AI generate ─────────────────────────────────────────────────────────────


@router.post(
    "/whatsapp/leads/{lead_id}/generate",
    response_model=WhatsAppMessageResponse,
    status_code=201,
)
async def generate_message(
    lead_id: UUID,
    req: GenerateWhatsAppMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI-generate a WhatsApp opener for the lead, persist it, and return it."""
    lead = await _get_lead_or_404(lead_id, db, current_user.tenant_id)

    generated = await wa_ai.generate_message(
        lead_name=lead.contact_name or lead.company_name,
        lead_company=lead.company_name,
        lead_designation=lead.designation,
        lead_sector=lead.sector_code or "it_ites",
        tone=req.tone,
        context=req.context,
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        lead_id=lead_id,
    )

    phone = wa_ai.normalize_phone(lead.phone)

    msg = WhatsAppMessage(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        lead_id=lead_id,
        created_by=current_user.id,
        direction="outbound",
        message_type="ai_generated",
        content=generated["content"],
        status="pending",
        ai_tone=req.tone,
        phone_number=phone,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return _enrich(msg, lead)


# ─── Send ─────────────────────────────────────────────────────────────────────


@router.post("/whatsapp/leads/{lead_id}/send", response_model=SendWhatsAppResult)
async def send_message(
    lead_id: UUID,
    req: SendWhatsAppMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a WhatsApp message to the lead's phone number.

    If ``WA_API_KEY`` / ``WA_PHONE_ID`` are not configured (or the tenant
    has no WhatsApp integration) the message is still saved to DB with
    status=failed and the error is returned in ``warning``.
    """
    lead = await _get_lead_or_404(lead_id, db, current_user.tenant_id)

    phone = wa_ai.normalize_phone(lead.phone)
    if not phone:
        raise HTTPException(400, "This lead has no phone number. Add one before sending.")

    # Save to DB first (status=pending)
    msg = WhatsAppMessage(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        lead_id=lead_id,
        created_by=current_user.id,
        direction="outbound",
        message_type=req.message_type,
        content=req.content,
        template_name=req.template_name,
        status="pending",
        ai_tone=req.ai_tone,
        phone_number=phone,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # Attempt send
    result = await wa_svc.whatsapp_service.send_message_for_tenant(
        db=db,
        tenant_id=current_user.tenant_id,
        to_phone=phone,
        message=req.content,
    )

    # Update status from result
    now = datetime.now(timezone.utc)
    success = result.get("status") == "sent"
    new_status = "sent" if success else "failed"
    wa_id = result.get("message_id")
    error = result.get("error")

    await db.execute(
        update(WhatsAppMessage)
        .where(WhatsAppMessage.id == msg.id)
        .values(
            status=new_status,
            wa_message_id=wa_id,
            error_message=error,
            sent_at=now if success else None,
            updated_at=now,
        )
    )
    await db.commit()

    logger.info(
        "[whatsapp] send lead=%s status=%s wa_id=%s",
        lead_id, new_status, wa_id,
    )

    return SendWhatsAppResult(
        success=success,
        message_id=str(msg.id),
        wa_message_id=wa_id,
        status=new_status,
        warning=error if not success else None,
    )


# ─── List — per lead ──────────────────────────────────────────────────────────


@router.get(
    "/whatsapp/leads/{lead_id}/messages",
    response_model=List[WhatsAppMessageResponse],
)
async def list_lead_messages(
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = await _get_lead_or_404(lead_id, db, current_user.tenant_id)
    rows = (
        await db.execute(
            select(WhatsAppMessage)
            .where(
                WhatsAppMessage.lead_id == lead_id,
                WhatsAppMessage.tenant_id == current_user.tenant_id,
            )
            .order_by(WhatsAppMessage.created_at.asc())
        )
    ).scalars().all()
    return [_enrich(m, lead) for m in rows]


# ─── List — global ────────────────────────────────────────────────────────────


@router.get("/whatsapp/messages", response_model=List[WhatsAppMessageResponse])
async def list_all_messages(
    status: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        select(WhatsAppMessage, Lead)
        .join(Lead, WhatsAppMessage.lead_id == Lead.id)
        .where(WhatsAppMessage.tenant_id == current_user.tenant_id)
    )
    if status:
        q = q.where(WhatsAppMessage.status == status)
    if direction:
        q = q.where(WhatsAppMessage.direction == direction)
    q = q.order_by(WhatsAppMessage.created_at.desc()).limit(limit).offset(offset)

    rows = (await db.execute(q)).all()
    return [_enrich(msg, lead) for msg, lead in rows]


# ─── Update ───────────────────────────────────────────────────────────────────


@router.patch("/whatsapp/messages/{message_id}", response_model=WhatsAppMessageResponse)
async def update_message(
    message_id: UUID,
    updates: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = (
        await db.execute(
            select(WhatsAppMessage).where(
                WhatsAppMessage.id == message_id,
                WhatsAppMessage.tenant_id == current_user.tenant_id,
            )
        )
    ).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Message not found")

    allowed = {"status", "content", "delivered_at", "read_at"}
    for k, v in updates.items():
        if k in allowed:
            setattr(msg, k, v)
    msg.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)

    lead = await _get_lead_or_404(msg.lead_id, db, current_user.tenant_id)
    return _enrich(msg, lead)


# ─── Delete ───────────────────────────────────────────────────────────────────


@router.delete("/whatsapp/messages/{message_id}", status_code=204)
async def delete_message(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = (
        await db.execute(
            select(WhatsAppMessage).where(
                WhatsAppMessage.id == message_id,
                WhatsAppMessage.tenant_id == current_user.tenant_id,
            )
        )
    ).scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Message not found")
    await db.delete(msg)
    await db.commit()


# ─── Meta webhook — verification ─────────────────────────────────────────────


@router.get("/webhooks/whatsapp", response_class=PlainTextResponse)
async def verify_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
):
    """Meta sends a GET to verify the webhook endpoint.
    We echo hub.challenge back when the token matches META_WEBHOOK_VERIFY_TOKEN.
    """
    if (
        hub_mode == "subscribe"
        and hub_verify_token
        and hub_verify_token == settings.META_WEBHOOK_VERIFY_TOKEN
        and hub_challenge
    ):
        logger.info("[whatsapp-webhook] verification passed")
        return hub_challenge

    logger.warning(
        "[whatsapp-webhook] verification failed: mode=%s token_match=%s",
        hub_mode,
        hub_verify_token == settings.META_WEBHOOK_VERIFY_TOKEN,
    )
    raise HTTPException(403, "Webhook verification failed")


# ─── Meta webhook — inbound events ───────────────────────────────────────────


@router.post("/webhooks/whatsapp", status_code=200)
async def receive_webhook(request: Request):
    """Receive inbound WhatsApp messages and status updates from Meta.

    Meta retries non-2xx for 72 h, so always return 200 even on parse
    errors — log and move on rather than triggering a retry storm.
    """
    try:
        payload = await request.json()
    except Exception:
        logger.warning("[whatsapp-webhook] could not parse payload")
        return {"ok": True}

    try:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                field = change.get("field")

                # ── inbound message ──────────────────────────────────────
                if field == "messages":
                    for wa_msg in value.get("messages", []):
                        await _handle_inbound_message(value, wa_msg)

                # ── status update (sent → delivered → read) ──────────────
                elif field == "messages":
                    for status_update in value.get("statuses", []):
                        await _handle_status_update(status_update)

                # Status updates are also under field="messages" with "statuses" key
                for status_update in value.get("statuses", []):
                    await _handle_status_update(status_update)

    except Exception as exc:  # noqa: BLE001
        logger.exception("[whatsapp-webhook] processing error: %s", exc)

    return {"ok": True}


async def _handle_inbound_message(value: dict, wa_msg: dict) -> None:
    """Persist an inbound message.  We look up the lead by phone number."""
    from_number = wa_msg.get("from")
    wa_id = wa_msg.get("id")
    text_content = (wa_msg.get("text") or {}).get("body") or ""
    msg_type = wa_msg.get("type", "text")

    if not from_number or not text_content:
        return

    # Identify tenant from the WABA phone number id in the metadata
    phone_number_id = value.get("metadata", {}).get("phone_number_id", "")

    async with AsyncSessionLocal() as db:
        # Find lead by phone number (fuzzy: last 10 digits)
        tail = from_number[-10:] if len(from_number) >= 10 else from_number
        lead = (
            await db.execute(
                select(Lead).where(Lead.phone.like(f"%{tail}"))
            )
        ).scalar_one_or_none()

        if not lead:
            logger.info(
                "[whatsapp-webhook] inbound from unknown number %s — skipping",
                from_number,
            )
            return

        # Check for duplicate (Meta can deliver the same event twice)
        existing = (
            await db.execute(
                select(WhatsAppMessage).where(
                    WhatsAppMessage.wa_message_id == wa_id
                )
            )
        ).scalar_one_or_none()
        if existing:
            return

        msg = WhatsAppMessage(
            id=uuid.uuid4(),
            tenant_id=lead.tenant_id,
            lead_id=lead.id,
            direction="inbound",
            message_type="inbound",
            content=text_content,
            status="received",
            wa_message_id=wa_id,
            phone_number=from_number,
        )
        db.add(msg)
        await db.commit()
        logger.info(
            "[whatsapp-webhook] saved inbound from lead=%s", lead.id
        )


async def _handle_status_update(status_update: dict) -> None:
    """Update delivery status (sent → delivered → read) on our DB row."""
    wa_id = status_update.get("id")
    new_status = status_update.get("status")  # sent | delivered | read | failed

    if not wa_id or not new_status:
        return

    async with AsyncSessionLocal() as db:
        msg = (
            await db.execute(
                select(WhatsAppMessage).where(WhatsAppMessage.wa_message_id == wa_id)
            )
        ).scalar_one_or_none()

        if not msg:
            return

        now = datetime.now(timezone.utc)
        updates: dict = {"status": new_status, "updated_at": now}
        if new_status == "delivered":
            updates["delivered_at"] = now
        elif new_status == "read":
            updates["read_at"] = now

        await db.execute(
            update(WhatsAppMessage)
            .where(WhatsAppMessage.wa_message_id == wa_id)
            .values(**updates)
        )
        await db.commit()
        logger.info(
            "[whatsapp-webhook] status %s → %s", wa_id[:20], new_status
        )
