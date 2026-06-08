"""Phase 8 — Reporting & Analytics.

Dedicated reporting endpoints that go beyond the real-time dashboard
snapshot in /analytics/dashboard.  All queries are tenant-scoped and
use RLS-aware sessions so no cross-tenant data leaks.

Endpoints
---------
GET /reports/leads      — lead growth, sector/stage/score breakdown
GET /reports/revenue    — monthly won revenue (12 months), pipeline by stage
GET /reports/outreach   — email campaigns, WhatsApp, LinkedIn, email sequences
GET /reports/activities — activity breakdown by type over the last 8 weeks
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone, date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, and_, case, text, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db, get_current_user
from models.user import User
from models.lead import Lead
from models.deal import Deal
from models.activity import Activity
from models.outreach_log import OutreachLog
from models.campaign import Campaign
from models.whatsapp_message import WhatsAppMessage
from models.linkedin_message import LinkedInMessage
from models.email_sequence import EmailSequence, SequenceEnrollment, SequenceEmailLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


# ─── helpers ──────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _month_start(dt: datetime) -> datetime:
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _months_ago(n: int, ref: datetime | None = None) -> datetime:
    ref = ref or _now()
    month = ref.month - n
    year = ref.year + (month - 1) // 12
    month = ((month - 1) % 12) + 1
    return ref.replace(year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0)


# ─── Lead report ──────────────────────────────────────────────────────────────

@router.get("/leads")
async def leads_report(
    days: int = 90,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns:
    - growth: [{date, count}] — daily new leads over last `days` days
    - by_sector: [{sector, count}] — top 10
    - by_stage: [{stage, count}]
    - by_score: [{bucket, count}] — 0-19, 20-39, 40-59, 60-79, 80-100
    - by_icp: [{icp_fit, count}]
    - totals: {total, with_email, with_phone, enriched, hot}
    """
    tenant_id: UUID = current_user.tenant_id
    now = _now()
    since = now - timedelta(days=days)

    # ── daily growth ──────────────────────────────────────────────────────────
    daily_rows = await db.execute(
        select(
            func.date_trunc("day", Lead.created_at).label("day"),
            func.count(Lead.id).label("count"),
        )
        .where(Lead.tenant_id == tenant_id, Lead.created_at >= since)
        .group_by(text("1"))
        .order_by(text("1"))
    )
    growth = [
        {"date": str(r.day.date()), "count": r.count}
        for r in daily_rows.fetchall()
    ]

    # ── by sector ─────────────────────────────────────────────────────────────
    sector_rows = await db.execute(
        select(Lead.sector, func.count(Lead.id).label("count"))
        .where(Lead.tenant_id == tenant_id, Lead.sector.isnot(None))
        .group_by(Lead.sector)
        .order_by(func.count(Lead.id).desc())
        .limit(10)
    )
    by_sector = [{"sector": r.sector, "count": r.count} for r in sector_rows.fetchall()]

    # ── by stage ──────────────────────────────────────────────────────────────
    stage_rows = await db.execute(
        select(Lead.stage, func.count(Lead.id).label("count"))
        .where(Lead.tenant_id == tenant_id)
        .group_by(Lead.stage)
        .order_by(func.count(Lead.id).desc())
    )
    by_stage = [{"stage": r.stage or "unknown", "count": r.count} for r in stage_rows.fetchall()]

    # ── score distribution ────────────────────────────────────────────────────
    bucket_expr = case(
        (Lead.lead_score < 20,  "0–19"),
        (Lead.lead_score < 40,  "20–39"),
        (Lead.lead_score < 60,  "40–59"),
        (Lead.lead_score < 80,  "60–79"),
        else_="80–100",
    )
    score_rows = await db.execute(
        select(bucket_expr.label("bucket"), func.count(Lead.id).label("count"))
        .where(Lead.tenant_id == tenant_id, Lead.lead_score.isnot(None))
        .group_by(text("1"))
        .order_by(text("1"))
    )
    bucket_order = ["0–19", "20–39", "40–59", "60–79", "80–100"]
    raw_scores = {r.bucket: r.count for r in score_rows.fetchall()}
    by_score = [{"bucket": b, "count": raw_scores.get(b, 0)} for b in bucket_order]

    # ── by ICP fit ────────────────────────────────────────────────────────────
    icp_rows = await db.execute(
        select(Lead.icp_fit, func.count(Lead.id).label("count"))
        .where(Lead.tenant_id == tenant_id, Lead.icp_fit.isnot(None))
        .group_by(Lead.icp_fit)
        .order_by(func.count(Lead.id).desc())
    )
    by_icp = [{"icp_fit": r.icp_fit, "count": r.count} for r in icp_rows.fetchall()]

    # ── totals ────────────────────────────────────────────────────────────────
    total = await db.scalar(select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id)) or 0
    with_email = await db.scalar(select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id, Lead.email.isnot(None))) or 0
    with_phone = await db.scalar(select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id, Lead.phone.isnot(None))) or 0
    hot = await db.scalar(select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id, Lead.lead_score >= 80)) or 0
    enriched = await db.scalar(
        select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id, Lead.linkedin_url.isnot(None))
    ) or 0

    return {
        "growth": growth,
        "by_sector": by_sector,
        "by_stage": by_stage,
        "by_score": by_score,
        "by_icp": by_icp,
        "totals": {
            "total": total,
            "with_email": with_email,
            "with_phone": with_phone,
            "enriched": enriched,
            "hot": hot,
        },
        "days": days,
    }


# ─── Revenue report ───────────────────────────────────────────────────────────

@router.get("/revenue")
async def revenue_report(
    months: int = 12,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns:
    - monthly_won: [{month, revenue, count}] — last `months` calendar months
    - pipeline_by_stage: [{stage_name, total_value, deal_count, weighted_value}]
    - status_counts: {open, won, lost, on_hold}
    - win_loss_trend: [{month, won, lost}] — for the same window
    - avg_deal_size: float (won deals)
    - top_deals: [{title, value_inr, stage_name, status, close_date}] top 5 open by value
    """
    tenant_id: UUID = current_user.tenant_id
    now = _now()
    window_start = _months_ago(months - 1, now)

    # ── monthly won revenue ───────────────────────────────────────────────────
    won_rows = await db.execute(
        select(
            func.date_trunc("month", Deal.won_at).label("month"),
            func.coalesce(func.sum(Deal.value_inr), 0).label("revenue"),
            func.count(Deal.id).label("count"),
        )
        .where(
            Deal.tenant_id == tenant_id,
            Deal.status == "won",
            Deal.won_at >= window_start,
        )
        .group_by(text("1"))
        .order_by(text("1"))
    )
    won_by_month: dict[str, dict] = {}
    for r in won_rows.fetchall():
        key = str(r.month.date().replace(day=1))
        won_by_month[key] = {"month": key, "revenue": float(r.revenue), "count": r.count}

    # Fill gaps so the chart has a point for every month
    monthly_won = []
    for i in range(months):
        d = _months_ago(months - 1 - i, now)
        key = str(d.date().replace(day=1))
        monthly_won.append(won_by_month.get(key, {"month": key, "revenue": 0.0, "count": 0}))

    # ── win/loss trend (same window) ──────────────────────────────────────────
    wl_won_rows = await db.execute(
        select(
            func.date_trunc("month", Deal.won_at).label("month"),
            func.count(Deal.id).label("cnt"),
        )
        .where(Deal.tenant_id == tenant_id, Deal.status == "won", Deal.won_at >= window_start)
        .group_by(text("1"))
    )
    wl_lost_rows = await db.execute(
        select(
            func.date_trunc("month", Deal.lost_at).label("month"),
            func.count(Deal.id).label("cnt"),
        )
        .where(Deal.tenant_id == tenant_id, Deal.status == "lost", Deal.lost_at >= window_start)
        .group_by(text("1"))
    )
    wl_won = {str(r.month.date().replace(day=1)): r.cnt for r in wl_won_rows.fetchall()}
    wl_lost = {str(r.month.date().replace(day=1)): r.cnt for r in wl_lost_rows.fetchall()}
    win_loss_trend = []
    for i in range(months):
        d = _months_ago(months - 1 - i, now)
        key = str(d.date().replace(day=1))
        win_loss_trend.append({"month": key, "won": wl_won.get(key, 0), "lost": wl_lost.get(key, 0)})

    # ── pipeline by stage ─────────────────────────────────────────────────────
    from models.pipeline_stage import PipelineStage
    stage_rows = await db.execute(
        select(
            PipelineStage.name.label("stage_name"),
            func.count(Deal.id).label("deal_count"),
            func.coalesce(func.sum(Deal.value_inr), 0).label("total_value"),
            func.coalesce(
                func.sum(Deal.value_inr * Deal.probability / 100), 0
            ).label("weighted_value"),
        )
        .join(Deal, and_(Deal.stage_id == PipelineStage.id, Deal.status == "open"), isouter=True)
        .where(PipelineStage.tenant_id == tenant_id)
        .group_by(PipelineStage.id, PipelineStage.name, PipelineStage.order_index)
        .order_by(PipelineStage.order_index)
    )
    pipeline_by_stage = [
        {
            "stage_name": r.stage_name,
            "deal_count": r.deal_count or 0,
            "total_value": float(r.total_value or 0),
            "weighted_value": float(r.weighted_value or 0),
        }
        for r in stage_rows.fetchall()
    ]

    # ── status counts ─────────────────────────────────────────────────────────
    status_rows = await db.execute(
        select(Deal.status, func.count(Deal.id).label("cnt"))
        .where(Deal.tenant_id == tenant_id)
        .group_by(Deal.status)
    )
    status_counts = {"open": 0, "won": 0, "lost": 0, "on_hold": 0}
    for r in status_rows.fetchall():
        if r.status in status_counts:
            status_counts[r.status] = r.cnt

    # ── avg deal size (won) ───────────────────────────────────────────────────
    avg_deal_size = float(
        await db.scalar(
            select(func.coalesce(func.avg(Deal.value_inr), 0))
            .where(Deal.tenant_id == tenant_id, Deal.status == "won", Deal.value_inr.isnot(None))
        ) or 0
    )

    # ── top 5 open deals by value ─────────────────────────────────────────────
    top_rows = await db.execute(
        select(Deal)
        .where(Deal.tenant_id == tenant_id, Deal.status == "open", Deal.value_inr.isnot(None))
        .order_by(Deal.value_inr.desc())
        .limit(5)
    )
    top_deals = []
    for deal in top_rows.scalars().all():
        stage_name: Optional[str] = None
        if deal.stage_id:
            stage = await db.get(PipelineStage, deal.stage_id)
            stage_name = stage.name if stage else None
        top_deals.append({
            "id": str(deal.id),
            "title": deal.title,
            "value_inr": float(deal.value_inr or 0),
            "stage_name": stage_name,
            "probability": deal.probability,
            "close_date": str(deal.close_date) if deal.close_date else None,
        })

    return {
        "monthly_won": monthly_won,
        "win_loss_trend": win_loss_trend,
        "pipeline_by_stage": pipeline_by_stage,
        "status_counts": status_counts,
        "avg_deal_size": avg_deal_size,
        "top_deals": top_deals,
        "months": months,
    }


# ─── Outreach report ──────────────────────────────────────────────────────────

@router.get("/outreach")
async def outreach_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns metrics across all outreach channels:
    - email_campaigns: [{name, sent, opened, replied, open_rate, reply_rate}] top 10
    - whatsapp: {total, sent, delivered, read, received, failed, reply_rate}
    - linkedin: {total, pending, sent, connected, replied, connection_rate, reply_rate}
    - email_sequences: {total, active_enrollments, completed, replied, completion_rate}
    - channel_summary: [{channel, sent, replied}] for bar chart
    """
    tenant_id: UUID = current_user.tenant_id

    # ── email campaigns ───────────────────────────────────────────────────────
    campaigns = await db.execute(
        select(Campaign)
        .where(Campaign.tenant_id == tenant_id)
        .order_by(Campaign.created_at.desc())
        .limit(10)
    )
    email_campaigns = []
    total_campaign_sent = 0
    total_campaign_replied = 0
    for c in campaigns.scalars().all():
        sent = await db.scalar(
            select(func.count(OutreachLog.id)).where(
                OutreachLog.campaign_id == c.id, OutreachLog.status == "sent"
            )
        ) or 0
        opened = await db.scalar(
            select(func.count(OutreachLog.id)).where(
                OutreachLog.campaign_id == c.id, OutreachLog.opened_at.isnot(None)
            )
        ) or 0
        replied = await db.scalar(
            select(func.count(OutreachLog.id)).where(
                OutreachLog.campaign_id == c.id, OutreachLog.replied_at.isnot(None)
            )
        ) or 0
        total_campaign_sent += sent
        total_campaign_replied += replied
        email_campaigns.append({
            "name": c.name,
            "sent": sent,
            "opened": opened,
            "replied": replied,
            "open_rate": round(opened / sent * 100, 1) if sent else 0,
            "reply_rate": round(replied / sent * 100, 1) if sent else 0,
        })

    # ── WhatsApp ──────────────────────────────────────────────────────────────
    wa_rows = await db.execute(
        select(WhatsAppMessage.status, func.count(WhatsAppMessage.id).label("cnt"))
        .where(WhatsAppMessage.tenant_id == tenant_id)
        .group_by(WhatsAppMessage.status)
    )
    wa_counts: dict[str, int] = {r.status: r.cnt for r in wa_rows.fetchall()}
    wa_total = sum(wa_counts.values())
    wa_sent = wa_counts.get("sent", 0) + wa_counts.get("delivered", 0) + wa_counts.get("read", 0)
    wa_replied = wa_counts.get("received", 0)
    whatsapp = {
        "total": wa_total,
        "sent": wa_counts.get("sent", 0),
        "delivered": wa_counts.get("delivered", 0),
        "read": wa_counts.get("read", 0),
        "received": wa_replied,
        "failed": wa_counts.get("failed", 0),
        "pending": wa_counts.get("pending", 0),
        "reply_rate": round(wa_replied / wa_sent * 100, 1) if wa_sent else 0,
    }

    # ── LinkedIn ──────────────────────────────────────────────────────────────
    li_rows = await db.execute(
        select(LinkedInMessage.status, func.count(LinkedInMessage.id).label("cnt"))
        .where(LinkedInMessage.tenant_id == tenant_id)
        .group_by(LinkedInMessage.status)
    )
    li_counts: dict[str, int] = {r.status: r.cnt for r in li_rows.fetchall()}
    li_total = sum(li_counts.values())
    li_sent = li_counts.get("sent", 0) + li_counts.get("connected", 0) + li_counts.get("replied", 0)
    li_connected = li_counts.get("connected", 0) + li_counts.get("replied", 0)
    li_replied = li_counts.get("replied", 0)
    linkedin = {
        "total": li_total,
        "pending": li_counts.get("pending", 0),
        "sent": li_counts.get("sent", 0),
        "connected": li_counts.get("connected", 0),
        "replied": li_replied,
        "connection_rate": round(li_connected / li_sent * 100, 1) if li_sent else 0,
        "reply_rate": round(li_replied / li_sent * 100, 1) if li_sent else 0,
    }

    # ── Email sequences ───────────────────────────────────────────────────────
    seq_total = await db.scalar(
        select(func.count(EmailSequence.id)).where(EmailSequence.tenant_id == tenant_id)
    ) or 0
    enroll_rows = await db.execute(
        select(SequenceEnrollment.status, func.count(SequenceEnrollment.id).label("cnt"))
        .where(SequenceEnrollment.tenant_id == tenant_id)
        .group_by(SequenceEnrollment.status)
    )
    enroll_counts: dict[str, int] = {r.status: r.cnt for r in enroll_rows.fetchall()}
    enroll_total = sum(enroll_counts.values())
    completed = enroll_counts.get("completed", 0)
    replied_seq = await db.scalar(
        select(func.count(SequenceEmailLog.id)).where(
            SequenceEmailLog.tenant_id == tenant_id,
            SequenceEmailLog.replied_at.isnot(None),
        )
    ) or 0
    seq_sent_total = await db.scalar(
        select(func.count(SequenceEmailLog.id)).where(
            SequenceEmailLog.tenant_id == tenant_id,
            SequenceEmailLog.status == "sent",
        )
    ) or 0
    email_sequences = {
        "total_sequences": seq_total,
        "active_enrollments": enroll_counts.get("active", 0),
        "completed": completed,
        "paused": enroll_counts.get("paused", 0),
        "total_enrollments": enroll_total,
        "emails_sent": seq_sent_total,
        "replied": replied_seq,
        "completion_rate": round(completed / enroll_total * 100, 1) if enroll_total else 0,
        "reply_rate": round(replied_seq / seq_sent_total * 100, 1) if seq_sent_total else 0,
    }

    # ── channel summary for stacked bar ──────────────────────────────────────
    channel_summary = [
        {"channel": "Email Campaigns", "sent": total_campaign_sent, "replied": total_campaign_replied},
        {"channel": "Email Sequences", "sent": seq_sent_total, "replied": replied_seq},
        {"channel": "WhatsApp", "sent": wa_sent, "replied": wa_replied},
        {"channel": "LinkedIn", "sent": li_sent, "replied": li_replied},
    ]

    return {
        "email_campaigns": email_campaigns,
        "whatsapp": whatsapp,
        "linkedin": linkedin,
        "email_sequences": email_sequences,
        "channel_summary": channel_summary,
    }


# ─── Activity report ──────────────────────────────────────────────────────────

@router.get("/activities")
async def activities_report(
    weeks: int = 8,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns:
    - weekly: [{week, call, email, meeting, note, total}] — last `weeks` weeks
    - by_type: [{type, count}]
    - recent: [{id, type, note, created_at}] last 20
    """
    tenant_id: UUID = current_user.tenant_id
    now = _now()
    since = now - timedelta(weeks=weeks)

    # ── weekly breakdown ──────────────────────────────────────────────────────
    weekly_rows = await db.execute(
        select(
            func.date_trunc("week", Activity.created_at).label("week"),
            Activity.type,
            func.count(Activity.id).label("cnt"),
        )
        .where(Activity.tenant_id == tenant_id, Activity.created_at >= since)
        .group_by(text("1"), Activity.type)
        .order_by(text("1"))
    )
    # Build week buckets
    week_data: dict[str, dict[str, int]] = {}
    for r in weekly_rows.fetchall():
        key = str(r.week.date())
        if key not in week_data:
            week_data[key] = {"week": key, "call": 0, "email": 0, "meeting": 0, "note": 0, "total": 0}
        t = r.type if r.type in ("call", "email", "meeting", "note") else "note"
        week_data[key][t] = week_data[key].get(t, 0) + r.cnt
        week_data[key]["total"] += r.cnt

    # Fill empty weeks
    weekly: list[dict] = []
    for i in range(weeks):
        d = (now - timedelta(weeks=weeks - 1 - i))
        # Monday of that week
        monday = (d - timedelta(days=d.weekday())).date()
        key = str(monday)
        weekly.append(week_data.get(key, {"week": key, "call": 0, "email": 0, "meeting": 0, "note": 0, "total": 0}))

    # ── by type ───────────────────────────────────────────────────────────────
    type_rows = await db.execute(
        select(Activity.type, func.count(Activity.id).label("cnt"))
        .where(Activity.tenant_id == tenant_id)
        .group_by(Activity.type)
        .order_by(func.count(Activity.id).desc())
    )
    by_type = [{"type": r.type or "note", "count": r.cnt} for r in type_rows.fetchall()]

    # ── recent ────────────────────────────────────────────────────────────────
    recent_rows = await db.execute(
        select(Activity)
        .where(Activity.tenant_id == tenant_id)
        .order_by(Activity.created_at.desc())
        .limit(20)
    )
    recent = [
        {
            "id": str(a.id),
            "type": a.type,
            "note": a.note,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in recent_rows.scalars().all()
    ]

    return {
        "weekly": weekly,
        "by_type": by_type,
        "recent": recent,
        "weeks": weeks,
    }
