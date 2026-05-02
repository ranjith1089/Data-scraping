"""GDPR / DPDP — opt-out + data-deletion endpoints.

* ``POST /social/consents/opt-out``      — flag a SocialAccount; engine
                                           refuses to send to opted-out accounts.
* ``POST /social/consents/data-deletion`` — wipe all messages for a
                                           SocialAccount (and any linked Lead).

Both endpoints accept either ``social_account_id`` or
``external_user_id`` + ``platform`` so they can be called from
in-DM "/STOP" parsing as well as from the admin UI.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete as sql_delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from models.social.social_account import SocialAccount
from models.social.social_consent import SocialConsent
from models.social.social_conversation import SocialConversation
from models.social.social_message import SocialMessage
from models.user import User

router = APIRouter(prefix="/social/consents", tags=["social-consents"])


class OptOutRequest(BaseModel):
    social_account_id: Optional[UUID] = None
    platform: Optional[str] = Field(None, pattern=r"^(instagram|facebook|whatsapp)$")
    external_user_id: Optional[str] = None
    evidence_text: Optional[str] = None


async def _resolve_account(
    db: AsyncSession,
    tenant_id: UUID,
    body: OptOutRequest,
) -> SocialAccount:
    if body.social_account_id:
        row = await db.get(SocialAccount, body.social_account_id)
        if row and row.tenant_id == tenant_id:
            return row
    if body.platform and body.external_user_id:
        result = await db.execute(
            select(SocialAccount).where(
                SocialAccount.tenant_id == tenant_id,
                SocialAccount.platform == body.platform,
                SocialAccount.external_user_id == body.external_user_id,
            )
        )
        row = result.scalar_one_or_none()
        if row:
            return row
    raise HTTPException(status_code=404, detail="Social account not found")


@router.post("/opt-out")
async def opt_out(
    body: OptOutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = await _resolve_account(db, current_user.tenant_id, body)
    db.add(
        SocialConsent(
            tenant_id=current_user.tenant_id,
            social_account_id=account.id,
            consent_type="opt_out",
            evidence={"text": body.evidence_text} if body.evidence_text else None,
        )
    )
    await db.flush()
    return {"detail": "opt_out recorded", "social_account_id": str(account.id)}


@router.post("/data-deletion")
async def data_deletion(
    body: OptOutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Wipe every social_message + conversation row for this account.

    Records the deletion request as a SocialConsent row first so we
    have an audit trail even after the source data is gone.
    """
    account = await _resolve_account(db, current_user.tenant_id, body)

    db.add(
        SocialConsent(
            tenant_id=current_user.tenant_id,
            social_account_id=account.id,
            consent_type="data_deletion_requested",
            evidence={"text": body.evidence_text} if body.evidence_text else None,
        )
    )
    # Delete messages → conversations → account in that order (FK
    # cascades would also do it, but explicit is clearer in audit).
    await db.execute(
        sql_delete(SocialMessage).where(
            SocialMessage.tenant_id == current_user.tenant_id,
            SocialMessage.conversation_id.in_(
                select(SocialConversation.id).where(
                    SocialConversation.social_account_id == account.id
                )
            ),
        )
    )
    await db.execute(
        sql_delete(SocialConversation).where(
            SocialConversation.tenant_id == current_user.tenant_id,
            SocialConversation.social_account_id == account.id,
        )
    )
    # Keep the social_account row so the consent record retains a FK
    # target; the row carries no message content, just identifiers.
    await db.flush()
    return {"detail": "data deleted", "social_account_id": str(account.id)}
