"""Persist inbound social events as SocialAccount + Conversation + Message.

The single public entry point is :func:`upsert_inbound_message`. It:

1. Idempotently creates the ``SocialAccount`` (one per platform user)
   and refreshes ``last_seen_at`` + handle/display_name if they've
   changed since last sighting.
2. Idempotently creates the ``SocialConversation`` (one per
   tenant+account+platform).
3. Inserts a ``SocialMessage`` row with ``direction='inbound'``.
4. Detects webhook duplicates via the partial unique index on
   ``(platform, external_message_id)`` — returns ``was_duplicate=True``
   so the caller can short-circuit rule evaluation.
5. Updates the conversation's ``last_message_*`` denormalised fields
   so the inbox UI stays cheap to render.

All writes happen on the caller's session so they share one transaction
with the webhook receiver. RLS is the caller's responsibility (the
session must have ``SET LOCAL app.current_tenant`` applied).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from models.social.social_account import SocialAccount
from models.social.social_conversation import SocialConversation
from models.social.social_message import SocialMessage

logger = logging.getLogger(__name__)


async def upsert_social_account(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    platform: str,
    external_user_id: str,
    handle: Optional[str] = None,
    display_name: Optional[str] = None,
    profile_picture_url: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> SocialAccount:
    """Find-or-create the social_account row. Refresh handle / display_name
    if the platform has more recent values than what we cached."""
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.tenant_id == tenant_id,
            SocialAccount.platform == platform,
            SocialAccount.external_user_id == external_user_id,
        )
    )
    account = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if account is None:
        account = SocialAccount(
            tenant_id=tenant_id,
            platform=platform,
            external_user_id=external_user_id,
            handle=handle,
            display_name=display_name,
            profile_picture_url=profile_picture_url,
            metadata_json=metadata or {},
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(account)
        await db.flush()
        return account

    # Refresh last_seen + any newly-known fields.
    account.last_seen_at = now
    if handle and account.handle != handle:
        account.handle = handle
    if display_name and account.display_name != display_name:
        account.display_name = display_name
    if profile_picture_url and account.profile_picture_url != profile_picture_url:
        account.profile_picture_url = profile_picture_url
    return account


async def upsert_conversation(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    social_account: SocialAccount,
    platform: str,
) -> SocialConversation:
    """Find-or-create the conversation row for this account."""
    result = await db.execute(
        select(SocialConversation).where(
            SocialConversation.tenant_id == tenant_id,
            SocialConversation.social_account_id == social_account.id,
            SocialConversation.platform == platform,
        )
    )
    convo = result.scalar_one_or_none()
    if convo:
        return convo

    convo = SocialConversation(
        tenant_id=tenant_id,
        social_account_id=social_account.id,
        platform=platform,
        status="open",
    )
    db.add(convo)
    await db.flush()
    return convo


async def append_message(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    conversation: SocialConversation,
    direction: str,
    source: str,
    content: Optional[str],
    external_message_id: Optional[str] = None,
    attachments: Optional[list[dict[str, Any]]] = None,
    trigger_post_id: Optional[UUID] = None,
    rule_id: Optional[UUID] = None,
    received_at: Optional[datetime] = None,
    sent_at: Optional[datetime] = None,
    status: str = "received",
    error: Optional[str] = None,
) -> tuple[Optional[SocialMessage], bool]:
    """Insert a SocialMessage row.

    Returns ``(message, was_duplicate)``. On webhook redelivery (same
    ``external_message_id`` for the same ``platform``) the partial
    unique index raises IntegrityError; we swallow it and return
    ``(None, True)``. Caller should then skip rule evaluation.
    """
    msg = SocialMessage(
        tenant_id=tenant_id,
        conversation_id=conversation.id,
        platform=conversation.platform,
        direction=direction,
        source=source,
        external_message_id=external_message_id,
        content=content,
        attachments=attachments or [],
        trigger_post_id=trigger_post_id,
        rule_id=rule_id,
        received_at=received_at,
        sent_at=sent_at,
        status=status,
        error=error,
    )
    db.add(msg)
    try:
        await db.flush()
    except IntegrityError:
        # Webhook duplicate — same (platform, external_message_id) already
        # inserted by an earlier delivery. Roll back the savepoint and tell
        # the caller to ignore.
        await db.rollback()
        return None, True

    # Denormalise onto conversation for cheap inbox rendering.
    if direction == "inbound":
        conversation.unread_count = (conversation.unread_count or 0) + 1
    conversation.last_message_at = received_at or sent_at or datetime.now(timezone.utc)
    if content:
        conversation.last_message_preview = content[:240]
    conversation.updated_at = datetime.now(timezone.utc)
    return msg, False


async def upsert_inbound_message(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    platform: str,
    external_user_id: str,
    external_message_id: Optional[str],
    source: str,
    content: Optional[str],
    handle: Optional[str] = None,
    display_name: Optional[str] = None,
    profile_picture_url: Optional[str] = None,
    attachments: Optional[list[dict[str, Any]]] = None,
    trigger_post_id: Optional[UUID] = None,
    received_at: Optional[datetime] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> tuple[Optional[SocialMessage], Optional[SocialConversation], bool]:
    """One-call helper for webhook receivers.

    Returns ``(message, conversation, was_duplicate)``.

    Typical usage in ``routers/social/webhook_inbound.py``::

        msg, convo, dup = await upsert_inbound_message(
            db, tenant_id=...,
            platform="instagram",
            external_user_id=evt["sender"]["id"],
            external_message_id=evt["mid"],
            source="dm",
            content=evt["text"],
            received_at=datetime.fromtimestamp(evt["timestamp"], tz=timezone.utc),
        )
        if dup:
            return  # short-circuit, do not fire rules
        await rule_engine.evaluate_event(db, tenant_id, "dm.received", {...}, message=msg)
    """
    account = await upsert_social_account(
        db,
        tenant_id=tenant_id,
        platform=platform,
        external_user_id=external_user_id,
        handle=handle,
        display_name=display_name,
        profile_picture_url=profile_picture_url,
        metadata=metadata,
    )
    convo = await upsert_conversation(
        db,
        tenant_id=tenant_id,
        social_account=account,
        platform=platform,
    )
    msg, dup = await append_message(
        db,
        tenant_id=tenant_id,
        conversation=convo,
        direction="inbound",
        source=source,
        content=content,
        external_message_id=external_message_id,
        attachments=attachments,
        trigger_post_id=trigger_post_id,
        received_at=received_at,
    )
    if dup:
        return None, convo, True
    return msg, convo, False
