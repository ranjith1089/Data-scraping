"""External webhook handlers (SendGrid, etc.)."""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.dependencies import get_db_no_auth
from models.outreach_log import OutreachLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class SendGridEvent(BaseModel):
    email: Optional[str] = None
    event: str  # "open", "click", "bounce", "dropped", "delivered", "spamreport"
    sg_message_id: Optional[str] = None
    timestamp: Optional[int] = None
    url: Optional[str] = None
    reason: Optional[str] = None


@router.post("/sendgrid", status_code=status.HTTP_200_OK)
async def sendgrid_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db_no_auth),
):
    """
    Process SendGrid event webhooks.

    SendGrid posts a JSON array of event objects.
    We match each event to an OutreachLog by message_id and update timestamps.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    if not isinstance(body, list):
        body = [body]

    processed = 0
    skipped = 0

    for event_data in body:
        try:
            sg_message_id = event_data.get("sg_message_id")
            event_type = event_data.get("event", "")
            timestamp_unix = event_data.get("timestamp")

            if not sg_message_id:
                skipped += 1
                continue

            # SendGrid message IDs sometimes have a filter suffix; strip it
            clean_id = sg_message_id.split(".")[0] if sg_message_id else None
            if not clean_id:
                skipped += 1
                continue

            # Find outreach log by message_id
            result = await db.execute(
                select(OutreachLog).where(OutreachLog.message_id == clean_id)
            )
            log = result.scalar_one_or_none()

            # Also try the full message_id if short form didn't match
            if not log:
                result = await db.execute(
                    select(OutreachLog).where(OutreachLog.message_id == sg_message_id)
                )
                log = result.scalar_one_or_none()

            if not log:
                skipped += 1
                continue

            ts = (
                datetime.fromtimestamp(timestamp_unix, tz=timezone.utc)
                if timestamp_unix
                else datetime.now(timezone.utc)
            )

            if event_type == "delivered":
                log.status = "sent"
                if not log.sent_at:
                    log.sent_at = ts

            elif event_type == "open":
                if not log.opened_at:
                    log.opened_at = ts

            elif event_type == "click":
                if not log.clicked_at:
                    log.clicked_at = ts
                if not log.opened_at:
                    log.opened_at = ts

            elif event_type in ("bounce", "dropped"):
                log.status = "bounced"
                log.error_msg = event_data.get("reason", f"Email {event_type}")

            elif event_type == "spamreport":
                log.status = "spam"
                log.error_msg = "Recipient reported as spam"

            processed += 1

        except Exception as e:
            logger.warning(f"Error processing SendGrid event: {e}")
            skipped += 1
            continue

    await db.flush()

    return {
        "detail": "SendGrid events processed",
        "processed": processed,
        "skipped": skipped,
    }
