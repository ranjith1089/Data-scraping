"""Aggregate metrics for the Social Analytics page."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from models.automation_rule import AutomationRule
from models.lead import Lead
from models.social.social_campaign import SocialCampaign
from models.social.social_conversation import SocialConversation
from models.social.social_message import SocialMessage
from models.user import User
from schemas.social.analytics import (
    CampaignMetrics,
    FunnelStage,
    RuleMetrics,
    SocialAnalyticsByCampaign,
    SocialAnalyticsByRule,
    SocialAnalyticsFunnel,
    SocialAnalyticsOverview,
)

router = APIRouter(prefix="/social/analytics", tags=["social-analytics"])


def _since(period_days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=max(1, min(period_days, 365)))


@router.get("/overview", response_model=SocialAnalyticsOverview)
async def overview(
    period_days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = _since(period_days)
    base = select(SocialMessage).where(
        SocialMessage.tenant_id == current_user.tenant_id,
        SocialMessage.created_at >= since,
    )

    sent = (
        await db.scalar(
            select(func.count())
            .select_from(
                base.where(
                    SocialMessage.direction == "outbound",
                    SocialMessage.status.in_(["sent", "delivered"]),
                ).subquery()
            )
        )
        or 0
    )
    delivered = (
        await db.scalar(
            select(func.count())
            .select_from(
                base.where(
                    SocialMessage.direction == "outbound",
                    SocialMessage.status == "delivered",
                ).subquery()
            )
        )
        or 0
    )
    failed = (
        await db.scalar(
            select(func.count())
            .select_from(
                base.where(
                    SocialMessage.direction == "outbound",
                    SocialMessage.status == "failed",
                ).subquery()
            )
        )
        or 0
    )

    leads_created = (
        await db.scalar(
            select(func.count(Lead.id)).where(
                Lead.tenant_id == current_user.tenant_id,
                Lead.source == "instagram",
                Lead.created_at >= since,
            )
        )
        or 0
    )
    open_conversations = (
        await db.scalar(
            select(func.count(SocialConversation.id)).where(
                SocialConversation.tenant_id == current_user.tenant_id,
                SocialConversation.status == "open",
            )
        )
        or 0
    )
    conversion_rate = round((leads_created / sent * 100), 1) if sent else 0.0

    return SocialAnalyticsOverview(
        period_days=period_days,
        dms_sent=sent,
        dms_delivered=delivered,
        dms_failed=failed,
        leads_created=leads_created,
        conversion_rate=conversion_rate,
        avg_response_time_seconds=None,
        open_conversations=open_conversations,
    )


@router.get("/by-rule", response_model=SocialAnalyticsByRule)
async def by_rule(
    period_days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = _since(period_days)
    rules_q = await db.execute(
        select(AutomationRule).where(
            AutomationRule.tenant_id == current_user.tenant_id,
            AutomationRule.platform.is_not(None),
        )
    )
    rules: List[RuleMetrics] = []
    for rule in rules_q.scalars().all():
        fired = (
            await db.scalar(
                select(func.count(SocialMessage.id)).where(
                    SocialMessage.tenant_id == current_user.tenant_id,
                    SocialMessage.rule_id == rule.id,
                    SocialMessage.direction == "outbound",
                    SocialMessage.created_at >= since,
                )
            )
            or 0
        )
        success = (
            await db.scalar(
                select(func.count(SocialMessage.id)).where(
                    SocialMessage.tenant_id == current_user.tenant_id,
                    SocialMessage.rule_id == rule.id,
                    SocialMessage.direction == "outbound",
                    SocialMessage.status.in_(["sent", "delivered"]),
                    SocialMessage.created_at >= since,
                )
            )
            or 0
        )
        rules.append(
            RuleMetrics(
                rule_id=rule.id,
                rule_name=rule.name,
                fired_count=fired,
                leads_created=success,  # approximation; refined in commit 6
                success_rate=round((success / fired * 100), 1) if fired else 0.0,
            )
        )
    rules.sort(key=lambda r: r.fired_count, reverse=True)
    return SocialAnalyticsByRule(rules=rules)


@router.get("/by-campaign", response_model=SocialAnalyticsByCampaign)
async def by_campaign(
    period_days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = _since(period_days)
    camps_q = await db.execute(
        select(SocialCampaign).where(
            SocialCampaign.tenant_id == current_user.tenant_id
        )
    )
    out: List[CampaignMetrics] = []
    for c in camps_q.scalars().all():
        rule_ids_q = await db.execute(
            select(AutomationRule.id).where(AutomationRule.campaign_id == c.id)
        )
        rule_ids = [r for r in rule_ids_q.scalars().all()]
        if not rule_ids:
            out.append(
                CampaignMetrics(
                    campaign_id=c.id,
                    campaign_name=c.name,
                    dms_sent=0,
                    leads_created=0,
                    conversion_rate=0.0,
                )
            )
            continue
        sent = (
            await db.scalar(
                select(func.count(SocialMessage.id)).where(
                    SocialMessage.tenant_id == current_user.tenant_id,
                    SocialMessage.rule_id.in_(rule_ids),
                    SocialMessage.direction == "outbound",
                    SocialMessage.status.in_(["sent", "delivered"]),
                    SocialMessage.created_at >= since,
                )
            )
            or 0
        )
        out.append(
            CampaignMetrics(
                campaign_id=c.id,
                campaign_name=c.name,
                dms_sent=sent,
                leads_created=sent,  # approximation; refined in commit 6
                conversion_rate=0.0,
            )
        )
    return SocialAnalyticsByCampaign(campaigns=out)


@router.get("/funnel", response_model=SocialAnalyticsFunnel)
async def funnel(
    period_days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = _since(period_days)
    comments = (
        await db.scalar(
            select(func.count(SocialMessage.id)).where(
                SocialMessage.tenant_id == current_user.tenant_id,
                SocialMessage.direction == "inbound",
                SocialMessage.source.in_(["comment", "dm"]),
                SocialMessage.created_at >= since,
            )
        )
        or 0
    )
    dms_sent = (
        await db.scalar(
            select(func.count(SocialMessage.id)).where(
                SocialMessage.tenant_id == current_user.tenant_id,
                SocialMessage.direction == "outbound",
                SocialMessage.status.in_(["sent", "delivered"]),
                SocialMessage.created_at >= since,
            )
        )
        or 0
    )
    leads = (
        await db.scalar(
            select(func.count(Lead.id)).where(
                Lead.tenant_id == current_user.tenant_id,
                Lead.source == "instagram",
                Lead.created_at >= since,
            )
        )
        or 0
    )
    won = (
        await db.scalar(
            select(func.count(Lead.id)).where(
                Lead.tenant_id == current_user.tenant_id,
                Lead.source == "instagram",
                Lead.stage == "won",
                Lead.created_at >= since,
            )
        )
        or 0
    )
    return SocialAnalyticsFunnel(
        stages=[
            FunnelStage(stage="comments", count=comments),
            FunnelStage(stage="dms_sent", count=dms_sent),
            FunnelStage(stage="leads", count=leads),
            FunnelStage(stage="won", count=won),
        ]
    )
