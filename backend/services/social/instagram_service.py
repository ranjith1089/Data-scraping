"""Tenant-aware Instagram messaging service.

Mirrors the pattern of ``services/whatsapp_service.py``:

    await instagram_service.send_dm_for_tenant(
        db, tenant_id, recipient_external_id, message_body
    )

Resolves the tenant's ``instagram_dm`` Integration row (Fernet-encrypted
credentials), runs the rate limiter, dispatches through the
``InstagramDMIntegration`` plugin's ``push_event``, and updates the
queued ``social_messages`` row to ``status='sent'`` (or ``'failed'``
with the error).

Used by:

* The ``dispatch_pending_dms`` APScheduler job (commit 4) — picks up
  rows the rule engine queued.
* The conversations router (commit 4) when a rep manually replies in
  the unified inbox.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.crypto import decrypt_json
from models.integration import Integration
from models.social.social_message import SocialMessage
from services.integrations import get_integration

from . import rate_limiter

logger = logging.getLogger(__name__)


class InstagramService:
    """Tenant-aware sender for Instagram DMs."""

    async def _load_active_integration(
        self, db: AsyncSession, tenant_id: UUID
    ) -> Optional[Integration]:
        result = await db.execute(
            select(Integration).where(
                Integration.tenant_id == tenant_id,
                Integration.provider == "instagram_dm",
            )
        )
        row = result.scalar_one_or_none()
        if row and row.credentials_encrypted:
            return row
        return None

    async def send_dm_for_tenant(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        recipient_external_id: str,
        body: str,
        *,
        message_row_id: Optional[UUID] = None,
    ) -> dict[str, Any]:
        """Send an Instagram DM on behalf of a tenant.

        ``message_row_id`` (optional) — if provided, we update that
        ``social_messages`` row with the dispatch outcome
        (``status='sent'``, ``sent_at``, or ``status='failed'`` with
        ``error``). Used by the dispatch_pending_dms job.

        Returns ``{status, message_id?, error?, provider, rate_state?}``.
        """
        # 1) Tenant rate-limit
        ok, current, limit = await rate_limiter.check_and_consume(tenant_id)
        if not ok:
            outcome = {
                "status": "rate_limited",
                "error": f"Tenant rate limit reached ({current}/{limit} per hour).",
                "provider": "instagram_dm",
                "rate_state": {"current": current, "limit": limit},
            }
            if message_row_id:
                await self._update_message_row(
                    db, message_row_id, status="queued", error=outcome["error"]
                )
            return outcome

        # 2) Tenant integration
        integration = await self._load_active_integration(db, tenant_id)
        if not integration:
            outcome = {
                "status": "failed",
                "error": (
                    "No Instagram connection. Have the tenant click "
                    "Connect Instagram on the Social page."
                ),
                "provider": "instagram_dm",
            }
            if message_row_id:
                await self._update_message_row(
                    db, message_row_id, status="failed", error=outcome["error"]
                )
            return outcome

        plugin_cls = get_integration("instagram_dm")
        if plugin_cls is None:
            outcome = {
                "status": "failed",
                "error": "instagram_dm plugin not registered",
                "provider": "instagram_dm",
            }
            if message_row_id:
                await self._update_message_row(
                    db, message_row_id, status="failed", error=outcome["error"]
                )
            return outcome

        # 3) Dispatch
        try:
            plugin = plugin_cls(
                integration,
                credentials=decrypt_json(integration.credentials_encrypted),
            )
            result = await plugin.push_event(
                "text",
                {"recipient_id": recipient_external_id, "body": body},
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "Instagram push_event crashed for tenant=%s: %s",
                tenant_id,
                exc,
            )
            outcome = {
                "status": "failed",
                "error": f"{type(exc).__name__}: {exc}",
                "provider": "instagram_dm",
            }
            if message_row_id:
                await self._update_message_row(
                    db, message_row_id, status="failed", error=outcome["error"]
                )
            return outcome

        # 4) Update the social_messages row
        now = datetime.now(timezone.utc)
        if result.get("ok"):
            if message_row_id:
                await self._update_message_row(
                    db,
                    message_row_id,
                    status="sent",
                    sent_at=now,
                    error=None,
                )
            return {
                "status": "sent",
                "message_id": result.get("message_id"),
                "provider": "instagram_dm",
            }

        err = result.get("error") or "Unknown provider error"
        if message_row_id:
            await self._update_message_row(
                db, message_row_id, status="failed", error=err
            )
        return {"status": "failed", "error": err, "provider": "instagram_dm"}

    async def _update_message_row(
        self,
        db: AsyncSession,
        message_id: UUID,
        *,
        status: str,
        error: Optional[str] = None,
        sent_at: Optional[datetime] = None,
    ) -> None:
        """Best-effort update of the queued social_messages row."""
        try:
            row = await db.get(SocialMessage, message_id)
            if row is None:
                return
            row.status = status
            if error is not None:
                row.error = error[:500]
            if sent_at is not None:
                row.sent_at = sent_at
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Failed to update SocialMessage %s after dispatch: %s",
                message_id,
                exc,
            )


instagram_service = InstagramService()
