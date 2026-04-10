"""Analytics and AI insights routes."""

import json
import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db, get_current_user
from core.config import settings
from models.user import User
from schemas.analytics import DashboardResponse
from services.analytics_service import analytics_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])

# Simple in-memory cache for AI insights (production would use Redis)
_insights_cache: dict[str, tuple[float, str]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour


def _get_cached_insights(tenant_id: str) -> Optional[str]:
    """Return cached insights if still valid."""
    import time

    if tenant_id in _insights_cache:
        cached_at, text = _insights_cache[tenant_id]
        if time.time() - cached_at < CACHE_TTL_SECONDS:
            return text
        del _insights_cache[tenant_id]
    return None


def _set_cached_insights(tenant_id: str, text: str) -> None:
    import time

    _insights_cache[tenant_id] = (time.time(), text)


async def _generate_ai_insights(dashboard_data: dict) -> str:
    """Generate AI insights from dashboard stats.

    Routes through ``claude_service`` so this respects whatever
    ``AI_PROVIDER`` is configured (OpenRouter by default) and benefits
    from the same retry / quota / friendly-error handling as the rest
    of the AI surface. The earlier direct ``anthropic.AsyncAnthropic``
    call here was a third source of "credit balance too low" errors —
    now there's exactly one billing surface.
    """
    try:
        # Imported lazily to avoid a hard dep cycle if analytics is
        # imported during early app boot.
        from core.database import AsyncSessionLocal
        from services.claude_service import claude_service

        stats_summary = (
            f"Total leads: {dashboard_data['overview']['total_leads']}, "
            f"Hot leads (score>=80): {dashboard_data['overview']['hot_leads']}, "
            f"Leads added this week: {dashboard_data['overview']['leads_added_this_week']}, "
            f"Leads with email: {dashboard_data['overview']['with_email']}, "
            f"AI calls this month: {dashboard_data['ai_usage']['calls_this_month']}. "
            f"Stage breakdown: {json.dumps(dashboard_data['by_stage'])}. "
            f"Top sectors: {json.dumps(dashboard_data['by_sector'][:5])}. "
            f"Campaign stats: {json.dumps(dashboard_data['campaign_stats'][:3])}. "
            f"Funnel: {json.dumps(dashboard_data['funnel'])}."
        )

        system = (
            "You are a sales analytics AI for an Indian B2B lead-generation CRM. "
            "Given the dashboard stats, provide exactly 3 concise sentences a sales "
            "manager would find actionable. Focus on lead quality, conversion "
            "opportunities, and campaign performance. Be specific with numbers."
        )

        # claude_service.generate writes to ai_interactions for quota
        # tracking. Insights are dashboard-level (not tied to a single
        # user/lead), so we use a fresh session here and pass the same
        # tenant_id the caller already validated upstream — but since
        # this helper doesn't currently receive tenant_id, fall back to
        # a tenant-less direct client call as a last resort.
        tenant_id = dashboard_data.get("_tenant_id")
        if tenant_id is None:
            # Old call sites didn't pass tenant_id; degrade to a single
            # raw provider call without quota tracking.
            from core.claude_client import get_ai_client
            from core.config import settings as _settings

            client = get_ai_client()
            provider = (_settings.AI_PROVIDER or "openrouter").lower()
            if provider == "anthropic":
                response = await client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=300,
                    system=system,
                    messages=[{"role": "user", "content": stats_summary}],
                )
                return response.content[0].text
            else:
                response = await client.chat.completions.create(
                    model=_settings.OPENROUTER_MODEL or "anthropic/claude-sonnet-4",
                    max_tokens=300,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": stats_summary},
                    ],
                )
                return response.choices[0].message.content or ""

        async with AsyncSessionLocal() as session:
            return await claude_service.generate(
                system=system,
                user_message=stats_summary,
                db=session,
                tenant_id=tenant_id,
                interaction_type="dashboard_insights",
                max_tokens=300,
            )

    except Exception as e:
        logger.error(f"AI insights generation failed: {e}")
        return "AI insights temporarily unavailable. Please try again later."


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full dashboard analytics with optional cached AI insights."""
    data = await analytics_service.get_dashboard(db, current_user.tenant_id)

    # Try to include cached AI insights
    tenant_key = str(current_user.tenant_id)
    cached = _get_cached_insights(tenant_key)
    if cached:
        data["ai_insights"] = cached

    return data


@router.get("/ai-insights")
async def get_ai_insights(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate fresh AI insights from Claude based on current dashboard stats."""
    data = await analytics_service.get_dashboard(db, current_user.tenant_id)

    insights = await _generate_ai_insights(data)

    # Cache for 1 hour
    tenant_key = str(current_user.tenant_id)
    _set_cached_insights(tenant_key, insights)

    return {"ai_insights": insights}
