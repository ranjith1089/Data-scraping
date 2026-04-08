import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_, text

from models.lead import Lead
from models.campaign import Campaign
from models.outreach_log import OutreachLog
from models.ai_interaction import AIInteraction
from models.activity import Activity
from models.deal import Deal
from models.pipeline_stage import PipelineStage
from models.sector import Sector

logger = logging.getLogger(__name__)


class AnalyticsService:
    async def get_dashboard(self, db: AsyncSession, tenant_id: UUID) -> dict:
        """Aggregate all dashboard analytics for a tenant."""
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # --- Overview ---
        total = (
            await db.scalar(
                select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id)
            )
            or 0
        )
        with_email = (
            await db.scalar(
                select(func.count(Lead.id)).where(
                    Lead.tenant_id == tenant_id, Lead.email.isnot(None)
                )
            )
            or 0
        )
        with_phone = (
            await db.scalar(
                select(func.count(Lead.id)).where(
                    Lead.tenant_id == tenant_id, Lead.phone.isnot(None)
                )
            )
            or 0
        )
        hot = (
            await db.scalar(
                select(func.count(Lead.id)).where(
                    Lead.tenant_id == tenant_id, Lead.lead_score >= 80
                )
            )
            or 0
        )
        added_week = (
            await db.scalar(
                select(func.count(Lead.id)).where(
                    Lead.tenant_id == tenant_id, Lead.created_at >= week_ago
                )
            )
            or 0
        )

        # --- AI usage ---
        ai_calls = (
            await db.scalar(
                select(func.count(AIInteraction.id)).where(
                    AIInteraction.tenant_id == tenant_id,
                    AIInteraction.created_at >= month_start,
                )
            )
            or 0
        )
        tokens = (
            await db.scalar(
                select(
                    func.coalesce(
                        func.sum(
                            AIInteraction.prompt_tokens + AIInteraction.completion_tokens
                        ),
                        0,
                    )
                ).where(
                    AIInteraction.tenant_id == tenant_id,
                    AIInteraction.created_at >= month_start,
                )
            )
            or 0
        )

        from models.tenant import Tenant
        from core.config import settings

        tenant = await db.get(Tenant, tenant_id)
        limit = settings.get_ai_monthly_limit(tenant.plan if tenant else "starter")

        # --- By sector ---
        sector_stats = await db.execute(
            select(
                Lead.sector_code,
                func.count(Lead.id).label("count"),
                func.count(case((Lead.lead_score >= 80, 1))).label("hot_count"),
                func.coalesce(func.avg(Lead.lead_score), 0).label("avg_score"),
            )
            .where(Lead.tenant_id == tenant_id)
            .group_by(Lead.sector_code)
        )
        sectors = await db.execute(select(Sector))
        sector_names = {s.code: s.name for s in sectors.scalars().all()}

        by_sector = [
            {
                "sector": r.sector_code,
                "sector_name": sector_names.get(r.sector_code, r.sector_code),
                "count": r.count,
                "hot_count": r.hot_count,
                "avg_score": round(float(r.avg_score), 1),
            }
            for r in sector_stats.fetchall()
        ]

        # --- By stage ---
        stage_stats = await db.execute(
            select(
                Lead.stage,
                func.count(Lead.id).label("count"),
                func.coalesce(func.sum(Lead.annual_revenue_inr), 0).label("total_value"),
            )
            .where(Lead.tenant_id == tenant_id)
            .group_by(Lead.stage)
        )
        by_stage = [
            {
                "stage": r.stage,
                "count": r.count,
                "total_value_inr": int(r.total_value),
            }
            for r in stage_stats.fetchall()
        ]

        # --- By district (top 10) ---
        district_stats = await db.execute(
            select(Lead.district, func.count(Lead.id).label("count"))
            .where(Lead.tenant_id == tenant_id, Lead.district.isnot(None))
            .group_by(Lead.district)
            .order_by(func.count(Lead.id).desc())
            .limit(10)
        )
        by_district = [
            {"district": r.district, "count": r.count}
            for r in district_stats.fetchall()
        ]

        # --- Campaign stats ---
        campaigns = await db.execute(
            select(Campaign)
            .where(Campaign.tenant_id == tenant_id)
            .order_by(Campaign.created_at.desc())
            .limit(10)
        )
        campaign_stats = []
        for c in campaigns.scalars().all():
            sent = (
                await db.scalar(
                    select(func.count(OutreachLog.id)).where(
                        OutreachLog.campaign_id == c.id, OutreachLog.status == "sent"
                    )
                )
                or 0
            )
            opened = (
                await db.scalar(
                    select(func.count(OutreachLog.id)).where(
                        OutreachLog.campaign_id == c.id,
                        OutreachLog.opened_at.isnot(None),
                    )
                )
                or 0
            )
            replied = (
                await db.scalar(
                    select(func.count(OutreachLog.id)).where(
                        OutreachLog.campaign_id == c.id,
                        OutreachLog.replied_at.isnot(None),
                    )
                )
                or 0
            )
            campaign_stats.append(
                {
                    "name": c.name,
                    "sent": sent,
                    "opened": opened,
                    "replied": replied,
                    "open_rate": round(opened / sent * 100, 1) if sent > 0 else 0,
                }
            )

        # --- Funnel ---
        funnel_stages = {
            "awareness": ["new"],
            "interest": ["contacted"],
            "consideration": ["engaged"],
            "intent": ["demo"],
            "demo": ["demo"],
            "proposal": ["proposal", "negotiation"],
            "won": ["won"],
        }
        funnel = {}
        for key, stages in funnel_stages.items():
            count = (
                await db.scalar(
                    select(func.count(Lead.id)).where(
                        Lead.tenant_id == tenant_id, Lead.stage.in_(stages)
                    )
                )
                or 0
            )
            funnel[key] = count

        # --- Activity feed (last 15) ---
        activities = await db.execute(
            select(Activity)
            .where(Activity.tenant_id == tenant_id)
            .order_by(Activity.created_at.desc())
            .limit(15)
        )
        activity_feed = [
            {
                "id": str(a.id),
                "type": a.type,
                "note": a.note,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in activities.scalars().all()
        ]

        return {
            "overview": {
                "total_leads": total,
                "with_email": with_email,
                "with_phone": with_phone,
                "hot_leads": hot,
                "leads_added_this_week": added_week,
            },
            "ai_usage": {
                "calls_this_month": ai_calls,
                "tokens_used": tokens,
                "calls_remaining": max(0, limit - ai_calls),
            },
            "by_sector": by_sector,
            "by_stage": by_stage,
            "by_district": by_district,
            "campaign_stats": campaign_stats,
            "funnel": funnel,
            "activity_feed": activity_feed,
            "ai_insights": "",  # Filled by AI router
        }


analytics_service = AnalyticsService()
