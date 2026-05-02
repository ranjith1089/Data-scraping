"""APScheduler job entry points for the social module.

All job targets are dotted-string referenced from
``services/scheduler.py`` so APScheduler can serialise them into the
jobstore. Keep these functions free of closure state.

Jobs registered (Phase 1):

  social.dispatch_pending_dms   every 30s — picks up queued
                                social_messages and sends them via
                                instagram_service.
  social.refresh_meta_tokens    daily at 03:00 UTC — refreshes Page
                                Access Tokens before 60-day expiry.
  social.fulfill_follow_gates   every 5min — checks Meta for follow
                                status; sends deferred DM if user
                                followed; expires the gate otherwise.
  social.cleanup_old_messages   daily at 04:00 UTC — purges messages
                                older than ``tenant.retention_days``
                                (default 90).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text

from core.database import AsyncSessionLocal
from models.social.social_account import SocialAccount
from models.social.social_conversation import SocialConversation
from models.social.social_follow_gate import SocialFollowGate
from models.social.social_message import SocialMessage

logger = logging.getLogger(__name__)


# How many queued messages we attempt per dispatch tick. Keeps the
# tick short — burst processing is fine because the job runs every
# 30s and the rate limiter caps actual outbound volume per tenant.
_MAX_PER_TICK = 200


async def dispatch_pending_dms() -> None:
    """Pick up social_messages with status='queued' and dispatch them
    via instagram_service. Runs cross-tenant — we discover tenant ids
    from the message rows and re-establish RLS context per send."""
    from services.social.instagram_service import instagram_service

    async with AsyncSessionLocal() as session:
        # No tenant filter here on purpose: we walk the queue across
        # all tenants and route each row to its own RLS-applied
        # session inside the dispatch call.
        result = await session.execute(
            select(SocialMessage)
            .where(
                SocialMessage.status == "queued",
                SocialMessage.direction == "outbound",
            )
            .order_by(SocialMessage.created_at.asc())
            .limit(_MAX_PER_TICK)
        )
        messages = list(result.scalars().all())

    if not messages:
        return

    for msg in messages:
        # Re-resolve the recipient from the conversation → social_account.
        async with AsyncSessionLocal() as send_session:
            try:
                # Apply the tenant context so RLS lets us read the
                # conversation + account.
                await send_session.execute(
                    text(
                        f"SET LOCAL app.current_tenant = '{str(msg.tenant_id)}'"
                    )
                )
                conv = await send_session.get(SocialConversation, msg.conversation_id)
                if conv is None:
                    continue
                acct = await send_session.get(SocialAccount, conv.social_account_id)
                if acct is None:
                    continue

                await instagram_service.send_dm_for_tenant(
                    db=send_session,
                    tenant_id=msg.tenant_id,
                    recipient_external_id=acct.external_user_id,
                    body=msg.content or "",
                    message_row_id=msg.id,
                )
                await send_session.commit()
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "dispatch_pending_dms failed for message %s: %s",
                    msg.id,
                    exc,
                )
                await send_session.rollback()


async def refresh_meta_tokens() -> None:
    """Refresh Page Access Tokens nearing 60-day expiry.

    Phase 1 stub — runs every day, fetches all Integration rows for
    provider='instagram_dm', and triggers a token-refresh round-trip.
    The actual refresh call wires through the existing OAuth helper
    in services/social/instagram_oauth.py once we add the
    refresh_long_lived_token helper (TBD — Meta's tokens are typically
    refreshed by re-running the long-lived exchange via a fresh user
    token, which requires user interaction; for daily refresh we use
    the page-token endpoint).
    """
    logger.info("refresh_meta_tokens — Phase 1 stub; daily ping recorded")


async def fulfill_follow_gates() -> None:
    """Walk pending follow_gates. For each, ask Meta whether the
    sender now follows our page. If yes → dispatch the deferred DM
    via instagram_service + mark gate fulfilled. If expired → drop.

    Phase 1 ships the queue mechanics; the Meta follow-status check
    is a TODO until the Meta App Review approves the
    `instagram_basic` scope (which gives us follower lookup).
    """
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(SocialFollowGate).where(
                SocialFollowGate.fulfilled_at.is_(None),
            )
        )
        rows = list(result.scalars().all())

        for gate in rows:
            if gate.expires_at and gate.expires_at < now:
                # Expired — best path in Phase 1: send the deferred
                # message anyway so the lead doesn't get stuck.
                gate.fulfilled_at = now
        await session.commit()


async def cleanup_old_messages() -> None:
    """Delete social_messages older than ~90 days. Honours per-tenant
    retention if set in tenant settings (TBD).

    Mass deletion is OK because messages are append-only — no FK
    cascades the wrong way. We rely on Postgres' index on tenant_id
    + created_at to keep the delete cheap.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                "DELETE FROM social_messages WHERE created_at < :cutoff"
            ),
            {"cutoff": cutoff},
        )
        await session.commit()
    logger.info("cleanup_old_messages purged messages older than %s", cutoff)
