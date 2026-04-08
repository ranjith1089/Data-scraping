import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as aioredis

from core.config import settings
from core.dependencies import get_db, get_current_user
from services.claude_service import claude_service
from services.sector_config import get_sector_config, SECTOR_CONFIGS
from models.sector import Sector
from models.user import User
from schemas.ai import SectorBriefResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

CACHE_TTL = 86400  # 24 hours

SYSTEM_PROMPT = (
    "You are a B2B market intelligence analyst specialising in Indian industries. "
    "Generate a concise, actionable sector intelligence brief for a sales team. "
    "Focus on practical insights that help reps sell more effectively. "
    "Use real Indian market context, regulations, and business culture references. "
    "Respond ONLY with valid JSON. No markdown. No explanation."
)


@router.get("/sector-brief/{sector_code}", response_model=SectorBriefResponse)
async def get_sector_brief(
    sector_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate sector code
    sector_config = get_sector_config(sector_code)
    result = await db.execute(select(Sector).where(Sector.code == sector_code))
    sector = result.scalar_one_or_none()

    if not sector and not sector_config:
        raise HTTPException(404, f"Unknown sector code: {sector_code}")

    sector_name = sector.name if sector else sector_config.get("name", sector_code)

    # Check Redis cache
    cache_key = f"sector_brief:{sector_code}"
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            data = json.loads(cached)
            return SectorBriefResponse(
                sector_code=sector_code,
                sector_name=sector_name,
                brief=data["brief"],
                generated_at=data["generated_at"],
            )
    except Exception:
        logger.warning("Redis cache read failed for %s, generating fresh", cache_key)

    # Build context from sector config and DB
    pain_points = []
    value_props = []

    if sector:
        pain_points = sector.pain_points or []
        value_props = sector.value_props or []

    if sector_config:
        if not pain_points:
            pain_points = sector_config.get("pain_points", [])
        if not value_props:
            value_props = sector_config.get("value_props", [])

    config_context = ""
    if sector_config:
        config_context = (
            f"Target designations: {', '.join(sector_config.get('target_designations', []))}\n"
            f"Company size focus: {', '.join(sector_config.get('company_size_focus', []))}\n"
            f"Best outreach days: {', '.join(sector_config.get('best_outreach_days', []))}\n"
            f"Best outreach time: {sector_config.get('best_outreach_time', 'N/A')}\n"
            f"Avg deal cycle: {sector_config.get('avg_deal_cycle_days', 'N/A')} days\n"
            f"Avg deal value: INR {sector_config.get('avg_deal_value_inr', 'N/A')}\n"
        )

    user_prompt = (
        f"Generate a sector intelligence brief for: {sector_name} ({sector_code})\n\n"
        f"Known pain points: {', '.join(pain_points)}\n"
        f"Known value props: {', '.join(value_props)}\n"
        f"{config_context}\n"
        "Output JSON with these keys:\n"
        "{\n"
        '  "market_overview": "2-3 sentences on current market conditions in India",\n'
        '  "key_pain_points": ["list of top 5 pain points with brief context"],\n'
        '  "outreach_strategies": ["list of 3-4 effective outreach strategies"],\n'
        '  "key_dm_titles": ["list of decision-maker titles to target"],\n'
        '  "common_objections": [\n'
        '    {"objection": "...", "rebuttal": "..."}\n'
        "  ],\n"
        '  "market_trends": ["2-3 current trends affecting this sector"],\n'
        '  "best_opening_lines": ["3 strong email opening lines for this sector"],\n'
        '  "competitive_landscape": "1-2 sentences on typical competitors"\n'
        "}"
    )

    result_json = await claude_service.generate_json(
        system=SYSTEM_PROMPT,
        user_message=user_prompt,
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        interaction_type="sector_brief",
    )

    # Format brief as readable text
    brief_parts = []

    if result_json.get("market_overview"):
        brief_parts.append(f"**Market Overview**\n{result_json['market_overview']}")

    if result_json.get("key_pain_points"):
        points = "\n".join(f"- {p}" for p in result_json["key_pain_points"])
        brief_parts.append(f"**Key Pain Points**\n{points}")

    if result_json.get("outreach_strategies"):
        strategies = "\n".join(f"- {s}" for s in result_json["outreach_strategies"])
        brief_parts.append(f"**Outreach Strategies**\n{strategies}")

    if result_json.get("key_dm_titles"):
        titles = "\n".join(f"- {t}" for t in result_json["key_dm_titles"])
        brief_parts.append(f"**Key Decision-Maker Titles**\n{titles}")

    if result_json.get("common_objections"):
        objections = "\n".join(
            f"- Objection: {o.get('objection', '')}\n  Rebuttal: {o.get('rebuttal', '')}"
            for o in result_json["common_objections"]
        )
        brief_parts.append(f"**Common Objections & Rebuttals**\n{objections}")

    if result_json.get("market_trends"):
        trends = "\n".join(f"- {t}" for t in result_json["market_trends"])
        brief_parts.append(f"**Market Trends**\n{trends}")

    if result_json.get("best_opening_lines"):
        openers = "\n".join(f"- {o}" for o in result_json["best_opening_lines"])
        brief_parts.append(f"**Best Opening Lines**\n{openers}")

    if result_json.get("competitive_landscape"):
        brief_parts.append(
            f"**Competitive Landscape**\n{result_json['competitive_landscape']}"
        )

    brief = "\n\n".join(brief_parts)
    generated_at = datetime.now(timezone.utc).isoformat()

    # Cache in Redis
    cache_data = json.dumps({"brief": brief, "generated_at": generated_at})
    try:
        await redis_client.set(cache_key, cache_data, ex=CACHE_TTL)
    except Exception:
        logger.warning("Redis cache write failed for %s", cache_key)

    return SectorBriefResponse(
        sector_code=sector_code,
        sector_name=sector_name,
        brief=brief,
        generated_at=generated_at,
    )
