"""Email Sequences router — Phase 6.

Endpoints (all under /api/v1):

  Sequences
    GET    /email-sequences                      — list all
    POST   /email-sequences                      — create
    GET    /email-sequences/{id}                 — detail + steps
    PATCH  /email-sequences/{id}                 — update name/description/status
    DELETE /email-sequences/{id}                 — delete (draft only)

  Steps
    POST   /email-sequences/{id}/steps           — add step
    PATCH  /email-sequences/{id}/steps/{step_id} — edit step
    DELETE /email-sequences/{id}/steps/{step_id} — remove step

  Enrollment
    POST   /email-sequences/{id}/enroll          — enroll one lead
    POST   /email-sequences/{id}/enroll-bulk     — enroll N leads
    GET    /email-sequences/{id}/enrollments     — list enrollments

  Enrollment management
    GET    /enrollments/{enrollment_id}          — get enrollment
    PATCH  /enrollments/{enrollment_id}          — pause/resume/unsubscribe

  Stats
    GET    /email-sequences/{id}/stats           — open/reply rates per step

  Logs (SendGrid event webhook target)
    POST   /webhooks/sendgrid                    — track open/click/reply events
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from models.email_sequence import (
    EmailSequence,
    SequenceEmailLog,
    SequenceEnrollment,
    SequenceStep,
)
from models.lead import Lead
from models.user import User
from schemas.email_sequence import (
    BulkEnrollRequest,
    CreateSequenceRequest,
    CreateSequenceStepRequest,
    EnrollLeadRequest,
    EnrollmentResponse,
    SequenceDetailResponse,
    SequenceEmailLogResponse,
    SequenceResponse,
    SequenceStatsResponse,
    SequenceStepResponse,
    StepStat,
    UpdateEnrollmentRequest,
    UpdateSequenceRequest,
    UpdateSequenceStepRequest,
)
from services import email_sequence_service as seq_svc

logger = logging.getLogger(__name__)
router = APIRouter(tags=["email-sequences"])


# ─── helpers ─────────────────────────────────────────────────────────────────


async def _get_seq_or_404(seq_id: UUID, tenant_id: UUID, db: AsyncSession) -> EmailSequence:
    seq = (
        await db.execute(
            select(EmailSequence).where(
                EmailSequence.id == seq_id,
                EmailSequence.tenant_id == tenant_id,
            )
        )
    ).scalar_one_or_none()
    if not seq:
        raise HTTPException(404, "Sequence not found")
    return seq


async def _seq_counts(seq_id: UUID, db: AsyncSession) -> dict:
    """Return aggregate counts for a sequence."""
    rows = (
        await db.execute(
            select(
                SequenceEnrollment.status,
                func.count().label("n"),
            )
            .where(SequenceEnrollment.sequence_id == seq_id)
            .group_by(SequenceEnrollment.status)
        )
    ).all()

    counts: dict[str, int] = {}
    for row in rows:
        counts[row.status] = row.n

    reply_count = (
        await db.execute(
            select(func.count()).where(
                SequenceEmailLog.enrollment_id.in_(
                    select(SequenceEnrollment.id).where(
                        SequenceEnrollment.sequence_id == seq_id
                    )
                ),
                SequenceEmailLog.replied_at.isnot(None),
            )
        )
    ).scalar() or 0

    step_count = (
        await db.execute(
            select(func.count()).where(SequenceStep.sequence_id == seq_id)
        )
    ).scalar() or 0

    total = sum(counts.values())
    return {
        "step_count": step_count,
        "enrolled_count": total,
        "active_count": counts.get("active", 0),
        "completed_count": counts.get("completed", 0),
        "reply_count": reply_count,
    }


def _enrich_enrollment(e: SequenceEnrollment, lead: Lead, seq_name: str = "") -> EnrollmentResponse:
    r = EnrollmentResponse.model_validate(e)
    r.lead_company = lead.company_name
    r.lead_contact = lead.contact_name
    r.lead_email = lead.email
    r.sequence_name = seq_name
    return r


# ─── Sequences CRUD ──────────────────────────────────────────────────────────


@router.get("/email-sequences", response_model=List[SequenceResponse])
async def list_sequences(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(EmailSequence).where(EmailSequence.tenant_id == current_user.tenant_id)
    if status:
        q = q.where(EmailSequence.status == status)
    q = q.order_by(EmailSequence.created_at.desc())
    seqs = (await db.execute(q)).scalars().all()

    results = []
    for seq in seqs:
        counts = await _seq_counts(seq.id, db)
        r = SequenceResponse.model_validate(seq)
        r.step_count = counts["step_count"]
        r.enrolled_count = counts["enrolled_count"]
        r.active_count = counts["active_count"]
        r.completed_count = counts["completed_count"]
        r.reply_count = counts["reply_count"]
        results.append(r)
    return results


@router.post("/email-sequences", response_model=SequenceResponse, status_code=201)
async def create_sequence(
    req: CreateSequenceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seq = EmailSequence(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        name=req.name,
        description=req.description,
        status="draft",
        created_by=current_user.id,
    )
    db.add(seq)
    await db.commit()
    await db.refresh(seq)
    r = SequenceResponse.model_validate(seq)
    return r


@router.get("/email-sequences/{seq_id}", response_model=SequenceDetailResponse)
async def get_sequence(
    seq_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seq = await _get_seq_or_404(seq_id, current_user.tenant_id, db)
    steps = (
        await db.execute(
            select(SequenceStep)
            .where(SequenceStep.sequence_id == seq_id)
            .order_by(SequenceStep.step_order.asc())
        )
    ).scalars().all()

    counts = await _seq_counts(seq_id, db)
    r = SequenceDetailResponse.model_validate(seq)
    r.step_count = counts["step_count"]
    r.enrolled_count = counts["enrolled_count"]
    r.active_count = counts["active_count"]
    r.completed_count = counts["completed_count"]
    r.reply_count = counts["reply_count"]
    r.steps = [SequenceStepResponse.model_validate(s) for s in steps]
    return r


@router.patch("/email-sequences/{seq_id}", response_model=SequenceResponse)
async def update_sequence(
    seq_id: UUID,
    req: UpdateSequenceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seq = await _get_seq_or_404(seq_id, current_user.tenant_id, db)
    if req.name is not None:
        seq.name = req.name
    if req.description is not None:
        seq.description = req.description
    if req.status is not None:
        seq.status = req.status
    seq.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(seq)
    counts = await _seq_counts(seq_id, db)
    r = SequenceResponse.model_validate(seq)
    r.step_count = counts["step_count"]
    r.enrolled_count = counts["enrolled_count"]
    r.active_count = counts["active_count"]
    r.completed_count = counts["completed_count"]
    r.reply_count = counts["reply_count"]
    return r


@router.delete("/email-sequences/{seq_id}", status_code=204)
async def delete_sequence(
    seq_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seq = await _get_seq_or_404(seq_id, current_user.tenant_id, db)
    if seq.status != "draft":
        raise HTTPException(400, "Only draft sequences can be deleted")
    await db.delete(seq)
    await db.commit()


# ─── Steps CRUD ──────────────────────────────────────────────────────────────


@router.post(
    "/email-sequences/{seq_id}/steps",
    response_model=SequenceStepResponse,
    status_code=201,
)
async def add_step(
    seq_id: UUID,
    req: CreateSequenceStepRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seq = await _get_seq_or_404(seq_id, current_user.tenant_id, db)
    step = SequenceStep(
        id=uuid.uuid4(),
        sequence_id=seq.id,
        tenant_id=current_user.tenant_id,
        step_order=req.step_order,
        delay_days=req.delay_days,
        subject=req.subject,
        body=req.body,
        email_type=req.email_type,
        ai_tone=req.ai_tone,
    )
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return SequenceStepResponse.model_validate(step)


@router.patch(
    "/email-sequences/{seq_id}/steps/{step_id}",
    response_model=SequenceStepResponse,
)
async def update_step(
    seq_id: UUID,
    step_id: UUID,
    req: UpdateSequenceStepRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    step = (
        await db.execute(
            select(SequenceStep).where(
                SequenceStep.id == step_id,
                SequenceStep.sequence_id == seq_id,
                SequenceStep.tenant_id == current_user.tenant_id,
            )
        )
    ).scalar_one_or_none()
    if not step:
        raise HTTPException(404, "Step not found")

    for field, val in req.model_dump(exclude_none=True).items():
        setattr(step, field, val)
    step.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(step)
    return SequenceStepResponse.model_validate(step)


@router.delete("/email-sequences/{seq_id}/steps/{step_id}", status_code=204)
async def delete_step(
    seq_id: UUID,
    step_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    step = (
        await db.execute(
            select(SequenceStep).where(
                SequenceStep.id == step_id,
                SequenceStep.sequence_id == seq_id,
                SequenceStep.tenant_id == current_user.tenant_id,
            )
        )
    ).scalar_one_or_none()
    if not step:
        raise HTTPException(404, "Step not found")
    await db.delete(step)
    await db.commit()


# ─── Enrollment ──────────────────────────────────────────────────────────────


@router.post(
    "/email-sequences/{seq_id}/enroll",
    response_model=EnrollmentResponse,
    status_code=201,
)
async def enroll_lead(
    seq_id: UUID,
    req: EnrollLeadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lead = (
        await db.execute(
            select(Lead).where(
                Lead.id == req.lead_id,
                Lead.tenant_id == current_user.tenant_id,
            )
        )
    ).scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead not found")

    seq = await _get_seq_or_404(seq_id, current_user.tenant_id, db)

    try:
        enrollment = await seq_svc.enroll_lead(
            db=db,
            sequence_id=seq_id,
            lead_id=req.lead_id,
            tenant_id=current_user.tenant_id,
            enrolled_by=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(409, str(exc))

    return _enrich_enrollment(enrollment, lead, seq.name)


@router.post(
    "/email-sequences/{seq_id}/enroll-bulk",
    response_model=List[EnrollmentResponse],
    status_code=201,
)
async def bulk_enroll(
    seq_id: UUID,
    req: BulkEnrollRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seq = await _get_seq_or_404(seq_id, current_user.tenant_id, db)
    results = []
    for lead_id in req.lead_ids:
        lead = (
            await db.execute(
                select(Lead).where(
                    Lead.id == lead_id,
                    Lead.tenant_id == current_user.tenant_id,
                )
            )
        ).scalar_one_or_none()
        if not lead:
            continue
        try:
            enrollment = await seq_svc.enroll_lead(
                db=db,
                sequence_id=seq_id,
                lead_id=lead_id,
                tenant_id=current_user.tenant_id,
                enrolled_by=current_user.id,
            )
            results.append(_enrich_enrollment(enrollment, lead, seq.name))
        except ValueError:
            # Already enrolled — skip silently
            continue
    return results


@router.get(
    "/email-sequences/{seq_id}/enrollments",
    response_model=List[EnrollmentResponse],
)
async def list_enrollments(
    seq_id: UUID,
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_seq_or_404(seq_id, current_user.tenant_id, db)

    q = (
        select(SequenceEnrollment, Lead)
        .join(Lead, SequenceEnrollment.lead_id == Lead.id)
        .where(
            SequenceEnrollment.sequence_id == seq_id,
            SequenceEnrollment.tenant_id == current_user.tenant_id,
        )
    )
    if status:
        q = q.where(SequenceEnrollment.status == status)
    q = q.order_by(SequenceEnrollment.enrolled_at.desc()).limit(limit).offset(offset)

    rows = (await db.execute(q)).all()
    return [_enrich_enrollment(e, lead) for e, lead in rows]


# ─── Enrollment management ───────────────────────────────────────────────────


@router.get("/enrollments/{enrollment_id}", response_model=EnrollmentResponse)
async def get_enrollment(
    enrollment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        await db.execute(
            select(SequenceEnrollment, Lead, EmailSequence)
            .join(Lead, SequenceEnrollment.lead_id == Lead.id)
            .join(EmailSequence, SequenceEnrollment.sequence_id == EmailSequence.id)
            .where(
                SequenceEnrollment.id == enrollment_id,
                SequenceEnrollment.tenant_id == current_user.tenant_id,
            )
        )
    ).first()
    if not row:
        raise HTTPException(404, "Enrollment not found")
    e, lead, seq = row
    return _enrich_enrollment(e, lead, seq.name)


@router.patch("/enrollments/{enrollment_id}", response_model=EnrollmentResponse)
async def update_enrollment(
    enrollment_id: UUID,
    req: UpdateEnrollmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        await db.execute(
            select(SequenceEnrollment, Lead, EmailSequence)
            .join(Lead, SequenceEnrollment.lead_id == Lead.id)
            .join(EmailSequence, SequenceEnrollment.sequence_id == EmailSequence.id)
            .where(
                SequenceEnrollment.id == enrollment_id,
                SequenceEnrollment.tenant_id == current_user.tenant_id,
            )
        )
    ).first()
    if not row:
        raise HTTPException(404, "Enrollment not found")
    e, lead, seq = row

    now = datetime.now(timezone.utc)
    if req.status:
        e.status = req.status
        if req.status == "paused":
            e.next_step_at = None
        elif req.status == "active" and e.next_step_at is None and e.status != "completed":
            # Resume: schedule the next step for now
            e.next_step_at = now
    e.updated_at = now
    await db.commit()
    await db.refresh(e)
    return _enrich_enrollment(e, lead, seq.name)


# ─── Stats ────────────────────────────────────────────────────────────────────


@router.get("/email-sequences/{seq_id}/stats", response_model=SequenceStatsResponse)
async def sequence_stats(
    seq_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_seq_or_404(seq_id, current_user.tenant_id, db)

    # Enrollment breakdown
    enrollment_rows = (
        await db.execute(
            select(SequenceEnrollment.status, func.count().label("n"))
            .where(
                SequenceEnrollment.sequence_id == seq_id,
                SequenceEnrollment.tenant_id == current_user.tenant_id,
            )
            .group_by(SequenceEnrollment.status)
        )
    ).all()
    status_counts: dict[str, int] = {r.status: r.n for r in enrollment_rows}
    total_enrolled = sum(status_counts.values())

    # Log breakdown per step
    step_rows = (
        await db.execute(
            select(
                SequenceEmailLog.step_order,
                SequenceEmailLog.status,
                func.count().label("n"),
            )
            .where(
                SequenceEmailLog.tenant_id == current_user.tenant_id,
                SequenceEmailLog.enrollment_id.in_(
                    select(SequenceEnrollment.id).where(
                        SequenceEnrollment.sequence_id == seq_id
                    )
                ),
            )
            .group_by(SequenceEmailLog.step_order, SequenceEmailLog.status)
        )
    ).all()

    # Aggregate per step
    per_step_raw: dict[int, dict[str, int]] = {}
    for r in step_rows:
        if r.step_order is None:
            continue
        if r.step_order not in per_step_raw:
            per_step_raw[r.step_order] = {"sent": 0, "opened": 0, "replied": 0}
        if r.status in ("sent", "delivered", "opened", "clicked", "replied"):
            per_step_raw[r.step_order]["sent"] += r.n
        if r.status in ("opened", "clicked"):
            per_step_raw[r.step_order]["opened"] += r.n
        if r.status == "replied":
            per_step_raw[r.step_order]["replied"] += r.n

    # Pull step subjects for labels
    steps = (
        await db.execute(
            select(SequenceStep)
            .where(SequenceStep.sequence_id == seq_id)
            .order_by(SequenceStep.step_order.asc())
        )
    ).scalars().all()
    step_subjects = {s.step_order: s.subject for s in steps}

    per_step = []
    for order in sorted(per_step_raw.keys()):
        d = per_step_raw[order]
        sent = d["sent"]
        opened = d["opened"]
        replied = d["replied"]
        per_step.append(
            StepStat(
                step_order=order,
                subject=step_subjects.get(order, f"Step {order}"),
                sent=sent,
                opened=opened,
                replied=replied,
                open_rate=round(opened / sent * 100, 1) if sent else 0.0,
                reply_rate=round(replied / sent * 100, 1) if sent else 0.0,
            )
        )

    total_sent = sum(d["sent"] for d in per_step_raw.values())
    total_opened = sum(d["opened"] for d in per_step_raw.values())
    total_replied = sum(d["replied"] for d in per_step_raw.values())

    return SequenceStatsResponse(
        sequence_id=seq_id,
        total_enrolled=total_enrolled,
        active=status_counts.get("active", 0),
        completed=status_counts.get("completed", 0),
        unsubscribed=status_counts.get("unsubscribed", 0),
        total_sent=total_sent,
        total_opened=total_opened,
        total_replied=total_replied,
        overall_open_rate=round(total_opened / total_sent * 100, 1) if total_sent else 0.0,
        overall_reply_rate=round(total_replied / total_sent * 100, 1) if total_sent else 0.0,
        per_step=per_step,
    )


# ─── SendGrid event webhook ───────────────────────────────────────────────────


@router.post("/webhooks/sendgrid", status_code=200)
async def sendgrid_webhook(request: Request):
    """Handle SendGrid Inbound Parse / Event Webhook.

    Marks SequenceEmailLog rows as opened/clicked/replied based on the
    X-Message-Id header that SendGrid returns on POST /mail/send.

    Always returns 200 — SendGrid retries non-2xx.
    """
    try:
        events = await request.json()
        if not isinstance(events, list):
            events = [events]
    except Exception:
        return {"ok": True}

    async with AsyncSessionLocal() as db:  # noqa: F821 — imported below
        for ev in events:
            sg_id = ev.get("sg_message_id", "").split(".")[0]
            event_type = ev.get("event", "")
            if not sg_id or event_type not in ("open", "click", "reply", "bounce"):
                continue

            log = (
                await db.execute(
                    select(SequenceEmailLog).where(
                        SequenceEmailLog.sendgrid_message_id == sg_id
                    )
                )
            ).scalar_one_or_none()
            if not log:
                continue

            now = datetime.now(timezone.utc)
            if event_type == "open" and not log.opened_at:
                log.opened_at = now
                log.status = "opened"
            elif event_type in ("click",) and not log.opened_at:
                log.opened_at = now
                log.status = "clicked"
            elif event_type == "reply" and not log.replied_at:
                log.replied_at = now
                log.status = "replied"
                # Mark enrollment as replied so sequence stops
                enrollment = await db.get(SequenceEnrollment, log.enrollment_id)
                if enrollment and enrollment.status == "active":
                    enrollment.status = "replied"
                    enrollment.next_step_at = None
                    enrollment.updated_at = now
            elif event_type == "bounce":
                log.status = "bounced"
                enrollment = await db.get(SequenceEnrollment, log.enrollment_id)
                if enrollment and enrollment.status == "active":
                    enrollment.status = "bounced"
                    enrollment.next_step_at = None
                    enrollment.updated_at = now

        await db.commit()

    return {"ok": True}


# ─── deferred import so the webhook doesn't break if called before startup ───
from core.database import AsyncSessionLocal  # noqa: E402
