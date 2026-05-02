"""Unified DM inbox.

* GET    /social/conversations           list with filters
* GET    /social/conversations/{id}      thread view (messages paginated)
* POST   /social/conversations/{id}/messages  manual reply
* PATCH  /social/conversations/{id}      change status / assigned_to
* POST   /social/conversations/{id}/promote   create-or-link a Lead
"""

from __future__ import annotations

import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from models.lead import Lead
from models.social.social_account import SocialAccount
from models.social.social_conversation import SocialConversation
from models.social.social_message import SocialMessage
from models.user import User
from schemas.social.conversations import (
    ConversationDetailResponse,
    ConversationResponse,
    ConversationUpdate,
    ManualMessageRequest,
    PromoteToLeadRequest,
    SocialAccountResponse,
    SocialMessageResponse,
)
from services.social import message_persistence as mp
from services.social.instagram_service import instagram_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social/conversations", tags=["social-conversations"])


# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------

async def _load_conv_or_404(
    db: AsyncSession, tenant_id: UUID, conv_id: UUID
) -> SocialConversation:
    row = await db.get(SocialConversation, conv_id)
    if not row or row.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return row


async def _account_for(
    db: AsyncSession, conv: SocialConversation
) -> SocialAccount:
    acct = await db.get(SocialAccount, conv.social_account_id)
    if not acct:
        # Should be impossible — FK enforces it; guard for safety.
        raise HTTPException(status_code=500, detail="conversation orphaned")
    return acct


def _serialise_conv(
    conv: SocialConversation, account: SocialAccount
) -> ConversationResponse:
    return ConversationResponse(
        id=conv.id,
        platform=conv.platform,
        status=conv.status,
        assigned_to=conv.assigned_to,
        last_message_at=conv.last_message_at,
        last_message_preview=conv.last_message_preview,
        unread_count=conv.unread_count,
        account=SocialAccountResponse.model_validate(account),
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


# ---------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------

@router.get("/", response_model=List[ConversationResponse])
async def list_conversations(
    platform: Optional[str] = None,
    convo_status: Optional[str] = None,
    assigned_to: Optional[UUID] = None,
    q: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(SocialConversation, SocialAccount).join(
        SocialAccount, SocialAccount.id == SocialConversation.social_account_id
    ).where(SocialConversation.tenant_id == current_user.tenant_id)
    if platform:
        stmt = stmt.where(SocialConversation.platform == platform)
    if convo_status:
        stmt = stmt.where(SocialConversation.status == convo_status)
    if assigned_to:
        stmt = stmt.where(SocialConversation.assigned_to == assigned_to)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (SocialAccount.handle.ilike(like))
            | (SocialAccount.display_name.ilike(like))
            | (SocialConversation.last_message_preview.ilike(like))
        )
    stmt = stmt.order_by(desc(SocialConversation.last_message_at)).limit(
        max(1, min(limit, 200))
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [_serialise_conv(c, a) for (c, a) in rows]


@router.get("/{conv_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conv_id: UUID,
    msg_limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await _load_conv_or_404(db, current_user.tenant_id, conv_id)
    account = await _account_for(db, conv)

    msgs_q = await db.execute(
        select(SocialMessage)
        .where(SocialMessage.conversation_id == conv.id)
        .order_by(SocialMessage.created_at.asc())
        .limit(max(1, min(msg_limit, 500)))
    )
    messages = [
        SocialMessageResponse.model_validate(m) for m in msgs_q.scalars().all()
    ]

    base = _serialise_conv(conv, account)
    return ConversationDetailResponse(**base.model_dump(), messages=messages)


@router.patch("/{conv_id}", response_model=ConversationResponse)
async def update_conversation(
    conv_id: UUID,
    body: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = await _load_conv_or_404(db, current_user.tenant_id, conv_id)
    if body.status is not None:
        conv.status = body.status
        if body.status in ("closed", "snoozed"):
            conv.unread_count = 0
    if body.assigned_to is not None:
        conv.assigned_to = body.assigned_to
    await db.flush()
    account = await _account_for(db, conv)
    return _serialise_conv(conv, account)


@router.post("/{conv_id}/messages", response_model=SocialMessageResponse)
async def send_manual_message(
    conv_id: UUID,
    body: ManualMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manual reply from the inbox UI. Bypasses the rule engine —
    persists an outbound message immediately and dispatches via
    instagram_service."""
    conv = await _load_conv_or_404(db, current_user.tenant_id, conv_id)
    account = await _account_for(db, conv)

    msg, _dup = await mp.append_message(
        db=db,
        tenant_id=current_user.tenant_id,
        conversation=conv,
        direction="outbound",
        source="dm",
        content=body.content,
        status="queued",
    )
    if msg is None:
        raise HTTPException(status_code=500, detail="failed to queue message")

    # Best-effort synchronous dispatch. If the rate limiter / Meta
    # path fails, the row stays as queued; the dispatch_pending_dms
    # job (commit 4 scheduler) will retry.
    try:
        await instagram_service.send_dm_for_tenant(
            db=db,
            tenant_id=current_user.tenant_id,
            recipient_external_id=account.external_user_id,
            body=body.content,
            message_row_id=msg.id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Manual DM dispatch failed: %s", exc)
    await db.flush()
    return SocialMessageResponse.model_validate(msg)


@router.post("/{conv_id}/promote")
async def promote_to_lead(
    conv_id: UUID,
    body: PromoteToLeadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a Lead from this conversation, or merge tags onto an
    existing one. Idempotent: re-running just merges tags."""
    conv = await _load_conv_or_404(db, current_user.tenant_id, conv_id)
    account = await _account_for(db, conv)

    if account.lead_id:
        lead = await db.get(Lead, account.lead_id)
        if lead:
            existing = list(lead.tags or [])
            for t in body.tags:
                if t not in existing:
                    existing.append(t)
            lead.tags = existing
            return {"detail": "merged", "lead_id": str(lead.id)}

    company_name = (
        account.display_name or account.handle or "Instagram user"
    )[:200]
    lead = Lead(
        tenant_id=current_user.tenant_id,
        sector_code=body.sector_code,
        company_name=company_name,
        contact_name=account.display_name or account.handle,
        source="instagram",
        tags=body.tags or ["instagram", "manual-promote"],
        custom_fields={
            "instagram_handle": account.handle,
            "instagram_user_id": account.external_user_id,
            "source_platform": account.platform,
            "promoted_from_conversation": str(conv.id),
        },
        state="Tamil Nadu",
    )
    db.add(lead)
    await db.flush()
    account.lead_id = lead.id
    return {"detail": "created", "lead_id": str(lead.id)}
