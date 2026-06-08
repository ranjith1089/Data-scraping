"""Email Sequence drip engine — Phase 6.

Core responsibilities:
  - enroll_lead()           — enroll a single lead; sets next_step_at = now
  - process_due_steps()     — called by APScheduler every 5 min; sends
                              overdue steps and advances each enrollment
  - _render_template()      — substitutes {{contact}}/{{company}}/{{designation}}
  - _send_step()            — sends via email_service + writes SequenceEmailLog
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import AsyncSessionLocal
from models.email_sequence import (
    EmailSequence,
    SequenceEmailLog,
    SequenceEnrollment,
    SequenceStep,
)
from models.lead import Lead
from services.email_service import email_service

logger = logging.getLogger(__name__)

# ─── Template helpers ────────────────────────────────────────────────────────

_VAR_RE = re.compile(r"\{\{(\w+)\}\}")

_PLACEHOLDER: dict[str, str] = {
    "contact":     "there",
    "company":     "your company",
    "designation": "your role",
    "name":        "there",
}


def _render_template(text: str, lead: Lead) -> str:
    """Replace {{contact}}, {{company}}, {{designation}} with lead data."""
    def _replace(m: re.Match) -> str:
        key = m.group(1).lower()
        if key in ("contact", "name"):
            name = lead.contact_name or ""
            # Use first name only
            first = name.strip().split()[0] if name.strip() else ""
            return first or _PLACEHOLDER.get(key, key)
        if key == "company":
            return lead.company_name or _PLACEHOLDER["company"]
        if key == "designation":
            return lead.designation or _PLACEHOLDER["designation"]
        return m.group(0)  # leave unknown vars as-is

    return _VAR_RE.sub(_replace, text)


# ─── Enrollment ──────────────────────────────────────────────────────────────


async def enroll_lead(
    *,
    db: AsyncSession,
    sequence_id: UUID,
    lead_id: UUID,
    tenant_id: UUID,
    enrolled_by: Optional[UUID] = None,
) -> SequenceEnrollment:
    """Enroll a lead; schedules the first step for immediate dispatch.

    Raises ValueError if the lead is already enrolled in this sequence.
    """
    # Check for existing enrollment
    existing = (
        await db.execute(
            select(SequenceEnrollment).where(
                SequenceEnrollment.sequence_id == sequence_id,
                SequenceEnrollment.lead_id == lead_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise ValueError(f"Lead {lead_id} is already enrolled in sequence {sequence_id}")

    # Confirm sequence exists + belongs to tenant
    seq = (
        await db.execute(
            select(EmailSequence).where(
                EmailSequence.id == sequence_id,
                EmailSequence.tenant_id == tenant_id,
            )
        )
    ).scalar_one_or_none()
    if not seq:
        raise ValueError("Sequence not found")

    now = datetime.now(timezone.utc)
    enrollment = SequenceEnrollment(
        id=uuid.uuid4(),
        sequence_id=sequence_id,
        lead_id=lead_id,
        tenant_id=tenant_id,
        enrolled_by=enrolled_by,
        status="active",
        current_step=0,
        next_step_at=now,  # fire immediately on next scheduler pass
        enrolled_at=now,
    )
    db.add(enrollment)
    await db.commit()
    await db.refresh(enrollment)
    logger.info("[seq] enrolled lead=%s sequence=%s", lead_id, sequence_id)
    return enrollment


# ─── Step dispatch ───────────────────────────────────────────────────────────


async def _send_step(
    *,
    db: AsyncSession,
    enrollment: SequenceEnrollment,
    step: SequenceStep,
    lead: Lead,
) -> str:
    """Send one step email + log it. Returns 'sent' or 'failed'."""
    if not lead.email:
        return "failed"

    rendered_subject = _render_template(step.subject, lead)
    rendered_body = _render_template(step.body, lead)

    # Wrap plain-text body in a minimal HTML envelope
    body_html = "<br>".join(rendered_body.splitlines()) if rendered_body else ""
    body_html = f"<p>{body_html}</p>"

    result = await email_service.send_email_for_tenant(
        db=db,
        tenant_id=enrollment.tenant_id,
        to_email=lead.email,
        subject=rendered_subject,
        body_html=body_html,
        body_text=rendered_body,
    )

    status = "sent" if result.get("status") == "sent" else "failed"
    now = datetime.now(timezone.utc)

    log = SequenceEmailLog(
        id=uuid.uuid4(),
        enrollment_id=enrollment.id,
        step_id=step.id,
        lead_id=enrollment.lead_id,
        tenant_id=enrollment.tenant_id,
        step_order=step.step_order,
        subject=rendered_subject,
        status=status,
        sendgrid_message_id=result.get("message_id"),
        sent_at=now if status == "sent" else None,
        error_msg=result.get("error") if status == "failed" else None,
    )
    db.add(log)
    return status


async def _advance_enrollment(
    *,
    db: AsyncSession,
    enrollment: SequenceEnrollment,
    sent_step: SequenceStep,
    all_steps: list[SequenceStep],
    now: datetime,
) -> None:
    """Advance current_step, compute next_step_at, or mark completed."""
    # Steps are ordered by step_order; find the next one
    next_step = next(
        (s for s in all_steps if s.step_order == sent_step.step_order + 1), None
    )
    if next_step:
        next_at = now + timedelta(days=max(0, next_step.delay_days))
        enrollment.current_step = sent_step.step_order
        enrollment.next_step_at = next_at
    else:
        # No more steps — sequence complete
        enrollment.current_step = sent_step.step_order
        enrollment.status = "completed"
        enrollment.next_step_at = None
        enrollment.completed_at = now

    enrollment.updated_at = now


# ─── Scheduled job ───────────────────────────────────────────────────────────


async def process_due_steps() -> None:
    """Send all overdue enrollment steps.

    Called by APScheduler every 5 minutes. Each DB session is opened fresh;
    we use the module-level AsyncSessionLocal so the job has its own
    connection, independent of the HTTP request lifecycle.
    """
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        # Find active enrollments whose next_step_at has passed
        due = (
            await db.execute(
                select(SequenceEnrollment).where(
                    and_(
                        SequenceEnrollment.status == "active",
                        SequenceEnrollment.next_step_at.isnot(None),
                        SequenceEnrollment.next_step_at <= now,
                    )
                )
            )
        ).scalars().all()

        if not due:
            return

        logger.info("[seq] processing %d due enrollment(s)", len(due))

        for enrollment in due:
            try:
                await _process_one(db, enrollment, now)
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "[seq] failed to process enrollment=%s: %s", enrollment.id, exc
                )

        await db.commit()


async def _process_one(
    db: AsyncSession,
    enrollment: SequenceEnrollment,
    now: datetime,
) -> None:
    """Send the next step for a single enrollment."""
    # Load all steps for this sequence, ordered
    steps = (
        await db.execute(
            select(SequenceStep)
            .where(SequenceStep.sequence_id == enrollment.sequence_id)
            .order_by(SequenceStep.step_order.asc())
        )
    ).scalars().all()

    if not steps:
        # Sequence has no steps — mark complete
        enrollment.status = "completed"
        enrollment.next_step_at = None
        enrollment.updated_at = now
        return

    # The next step to send is current_step + 1 (steps are 1-based order)
    next_order = enrollment.current_step + 1
    next_step = next((s for s in steps if s.step_order == next_order), None)

    if not next_step:
        # No step with that order — sequence done
        enrollment.status = "completed"
        enrollment.next_step_at = None
        enrollment.completed_at = now
        enrollment.updated_at = now
        return

    lead = (await db.execute(select(Lead).where(Lead.id == enrollment.lead_id))).scalar_one_or_none()
    if not lead:
        enrollment.status = "failed"
        enrollment.next_step_at = None
        enrollment.updated_at = now
        return

    status = await _send_step(db=db, enrollment=enrollment, step=next_step, lead=lead)

    if status == "failed" and not lead.email:
        # No email address — stop the sequence
        enrollment.status = "failed"
        enrollment.next_step_at = None
        enrollment.updated_at = now
        return

    await _advance_enrollment(
        db=db,
        enrollment=enrollment,
        sent_step=next_step,
        all_steps=list(steps),
        now=now,
    )

    logger.info(
        "[seq] sent step=%d to lead=%s enrollment=%s status=%s",
        next_step.step_order,
        enrollment.lead_id,
        enrollment.id,
        status,
    )
