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
    """Generate AI insights from dashboard stats using Claude."""
    try:
        from core.claude_client import get_claude_client

        client = get_claude_client()

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

        prompt = (
            "You are a sales analytics AI for an Indian B2B lead-generation CRM. "
            "Given these dashboard stats, provide exactly 3 concise sentences a sales "
            "manager would find actionable. Focus on lead quality, conversion opportunities, "
            "and campaign performance. Be specific with numbers.\n\n"
            f"Stats: {stats_summary}"
        )

        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )

        return response.content[0].text

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
