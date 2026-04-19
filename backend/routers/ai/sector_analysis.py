"""POST /ai/sector-analysis — suggest adjacent high-potential sectors.

Reads the tenant's won leads (`stage='won'`), computes a profile
(sector mix, company-size distribution, revenue bands, designations),
then asks the AI to recommend two to four *adjacent* sectors the tenant
should expand into. Results are grounded in real data so recommendations
reference the tenant's actual win pattern, not generic market advice.

The response is intentionally lightweight JSON so the frontend can
render a clean modal without post-processing.
"""

from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from models.lead import Lead
from models.user import User
from schemas.ai import SectorAnalysisResponse, SectorRecommendation
from services.claude_service import claude_service
from services.sector_config import SECTOR_CONFIGS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])

_MIN_WON_LEADS = 1  # Still run with low counts — the AI is told to be explicit about uncertainty.
_MAX_LEADS_IN_PROMPT = 60  # Token budget cap.

SYSTEM_PROMPT = (
    "You are a B2B market-expansion strategist for Indian SaaS / services "
    "companies. You recommend adjacent industry sectors a sales team should "
    "expand into, grounded strictly in the tenant's actual won-deal pattern. "
    "Never invent numbers. If the sample is small, say so. "
    "Respond ONLY with valid JSON. No markdown, no prose, no explanations."
)


def _sector_name(code: str) -> str:
    cfg = SECTOR_CONFIGS.get(code) or {}
    return cfg.get("name") or code


@router.post("/sector-analysis", response_model=SectorAnalysisResponse)
async def run_sector_analysis(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SectorAnalysisResponse:
    # Fetch won leads for the tenant (RLS already filters by tenant).
    result = await db.execute(
        select(Lead).where(Lead.stage == "won").limit(500)
    )
    won_leads = list(result.scalars().all())

    if len(won_leads) < _MIN_WON_LEADS:
        raise HTTPException(
            status_code=422,
            detail=(
                "Not enough won deals yet to run sector analysis. "
                "Close at least one deal and try again."
            ),
        )

    # --- Build an aggregated profile the AI can reason over. -----------
    current_mix_counter: Counter[str] = Counter()
    value_by_sector: dict[str, int] = {}
    size_counter: Counter[str] = Counter()
    designations: list[str] = []
    company_examples: list[str] = []
    revenues: list[int] = []

    for lead in won_leads:
        code = lead.sector_code or "unknown"
        current_mix_counter[code] += 1
        if lead.annual_revenue_inr:
            value_by_sector[code] = value_by_sector.get(code, 0) + int(
                lead.annual_revenue_inr
            )
            revenues.append(int(lead.annual_revenue_inr))
        if lead.company_size:
            size_counter[str(lead.company_size)] += 1
        if getattr(lead, "designation", None):
            designations.append(str(lead.designation))
        if lead.company_name:
            company_examples.append(lead.company_name)

    current_sector_mix = [
        {
            "sector_code": code,
            "sector_name": _sector_name(code),
            "won_count": count,
            "won_value_inr": value_by_sector.get(code, 0),
        }
        for code, count in current_mix_counter.most_common()
    ]

    designation_summary = Counter(designations).most_common(10)
    size_summary = size_counter.most_common()
    sample_companies = company_examples[:_MAX_LEADS_IN_PROMPT]

    available_codes = list(SECTOR_CONFIGS.keys())
    already_strong = [
        c for c, n in current_mix_counter.items() if n >= max(2, len(won_leads) * 0.2)
    ]

    # --- Prompt --------------------------------------------------------
    user_prompt_lines = [
        "Tenant's current won-deal profile:",
        f"- Total won deals: {len(won_leads)}",
        f"- Current sector mix: {json.dumps(current_sector_mix)}",
        f"- Company-size distribution: {json.dumps(size_summary)}",
        f"- Top decision-maker designations: {json.dumps(designation_summary)}",
        f"- Sample won company names: {json.dumps(sample_companies[:20])}",
    ]
    if revenues:
        user_prompt_lines.append(
            f"- Annual revenue range (INR): min={min(revenues)}, "
            f"median={sorted(revenues)[len(revenues) // 2]}, max={max(revenues)}"
        )

    user_prompt_lines += [
        "",
        f"Available platform sector codes: {available_codes}",
        f"Sectors the tenant is already strong in: {already_strong}",
        "",
        "Recommend 2 to 4 adjacent sectors the tenant should expand into.",
        "Rules:",
        "1. sector_code MUST be one of the available platform sector codes.",
        "2. Do NOT recommend a sector already in 'strong' unless the expansion is into a distinct sub-segment.",
        "3. fit_score: 0-100 integer reflecting how much the current won pattern supports this recommendation.",
        "4. rationale: 2-3 sentences referencing the tenant's actual pattern (company size, designations, examples). Never invent numbers.",
        "5. signals: list 2-4 concrete signals from the data above.",
        "6. recommended_icp: 1 short sentence describing the ideal buyer in that sector.",
        "7. sample_designations: 3-5 decision-maker titles to target.",
        "",
        "Also produce a one-paragraph summary of the win pattern.",
        "",
        "Output JSON with EXACTLY this shape (no extra keys):",
        "{",
        '  "summary": "...",',
        '  "recommendations": [',
        "    {",
        '      "sector_code": "...",',
        '      "fit_score": 0,',
        '      "rationale": "...",',
        '      "signals": ["..."],',
        '      "recommended_icp": "...",',
        '      "sample_designations": ["..."]',
        "    }",
        "  ]",
        "}",
    ]

    user_prompt = "\n".join(user_prompt_lines)

    result_json: dict[str, Any] = await claude_service.generate_json(
        system=SYSTEM_PROMPT,
        user_message=user_prompt,
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        interaction_type="sector_analysis",
    )

    # --- Validate + enrich the recommendations --------------------------
    recs_raw = result_json.get("recommendations") or []
    recommendations: list[SectorRecommendation] = []
    for item in recs_raw:
        if not isinstance(item, dict):
            continue
        code = str(item.get("sector_code") or "").strip()
        if code not in SECTOR_CONFIGS:
            # Skip hallucinated codes rather than failing the whole call.
            logger.info("sector_analysis: dropped unknown sector_code '%s'", code)
            continue
        try:
            recommendations.append(
                SectorRecommendation(
                    sector_code=code,
                    sector_name=_sector_name(code),
                    fit_score=int(item.get("fit_score") or 0),
                    rationale=str(item.get("rationale") or "")[:1000],
                    signals=[str(s) for s in (item.get("signals") or []) if s][:6],
                    recommended_icp=(
                        str(item["recommended_icp"])[:300]
                        if item.get("recommended_icp")
                        else None
                    ),
                    sample_designations=[
                        str(d) for d in (item.get("sample_designations") or []) if d
                    ][:8],
                )
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("sector_analysis: dropped malformed recommendation: %s", exc)

    if not recommendations:
        raise HTTPException(
            status_code=502,
            detail=(
                "AI did not return any valid sector recommendations. "
                "Please try again in a moment."
            ),
        )

    return SectorAnalysisResponse(
        summary=str(result_json.get("summary") or "")[:2000],
        current_sector_mix=current_sector_mix,
        recommendations=recommendations,
        generated_at=datetime.now(timezone.utc).isoformat(),
        based_on_won_leads=len(won_leads),
    )
