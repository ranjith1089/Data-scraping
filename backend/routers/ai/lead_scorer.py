import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from core.dependencies import get_db, get_current_user
from services.claude_service import claude_service
from services.sector_config import get_sector_config
from models.lead import Lead
from models.sector import Sector
from models.tenant import Tenant
from models.user import User
from schemas.ai import LeadScoreRequest, LeadScoreResponse, LeadScoreResult

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])

BATCH_SIZE = 5

SYSTEM_PROMPT = (
    "You are a B2B sales strategist in India. Score leads 0-100 based on ICP match, "
    "contact quality, deal potential, and sector fit. Be strict — reserve 80-100 for "
    "genuine hot leads. A lead with no email AND no phone should rarely score above 40. "
    "A lead with a strong designation match, valid contact info, and sector fit can score "
    "70+. Respond ONLY with valid JSON array."
)


def _build_lead_context(lead: Lead, sector_name: str, sector_config: dict) -> dict:
    """Build a JSON-serialisable context dict for a single lead."""
    return {
        "lead_id": str(lead.id),
        "company_name": lead.company_name,
        "industry": lead.industry,
        "sub_industry": lead.sub_industry,
        "sector_code": lead.sector_code,
        "sector_name": sector_name,
        "state": lead.state,
        "district": lead.district,
        "city": lead.city,
        "company_size": lead.company_size,
        "annual_revenue_inr": lead.annual_revenue_inr,
        "contact_name": lead.contact_name,
        "designation": lead.designation,
        "has_email": bool(lead.email),
        "has_phone": bool(lead.phone),
        "has_linkedin": bool(lead.linkedin_url),
        "has_website": bool(lead.website),
        "current_score": lead.lead_score,
        "current_stage": lead.stage,
        "source": lead.source,
        "tags": lead.tags or [],
        "target_designations": sector_config.get("target_designations", []),
        "sector_pain_points": sector_config.get("pain_points", []),
    }


def _parse_score_array(raw: str) -> list[dict]:
    """Parse a JSON array from Claude response, handling code fences."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
        raise ValueError("Expected JSON array")
    except json.JSONDecodeError:
        # Try to find array in the text
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            try:
                parsed = json.loads(text[start:end])
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass
        logger.error("Failed to parse score array from Claude: %s", text[:300])
        raise ValueError("Could not parse JSON array from Claude response")


@router.post("/score-leads", response_model=LeadScoreResponse)
async def score_leads(
    req: LeadScoreRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not req.lead_ids:
        raise HTTPException(400, "No lead IDs provided")

    if len(req.lead_ids) > 50:
        raise HTTPException(400, "Maximum 50 leads per scoring request")

    # Load tenant ICP definition
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = tenant_result.scalar_one_or_none()
    icp_definition = {}
    if tenant and tenant.settings:
        icp_definition = tenant.settings.get("icp", {})

    # Load all requested leads
    leads_result = await db.execute(
        select(Lead).where(
            Lead.id.in_(req.lead_ids),
            Lead.tenant_id == current_user.tenant_id,
        )
    )
    leads = {lead.id: lead for lead in leads_result.scalars().all()}

    if not leads:
        raise HTTPException(404, "No matching leads found")

    # Pre-load sectors for all unique sector codes
    sector_codes = {l.sector_code for l in leads.values() if l.sector_code}
    sectors_result = await db.execute(
        select(Sector).where(Sector.code.in_(sector_codes)) if sector_codes else select(Sector).where(False)
    )
    sectors_map = {s.code: s for s in sectors_result.scalars().all()}

    # Build ordered list of leads preserving request order
    ordered_leads = []
    for lid in req.lead_ids:
        if lid in leads:
            ordered_leads.append(leads[lid])

    # Process in batches of BATCH_SIZE
    all_results: list[LeadScoreResult] = []
    total_tokens = 0

    for i in range(0, len(ordered_leads), BATCH_SIZE):
        batch = ordered_leads[i : i + BATCH_SIZE]
        batch_contexts = []

        for lead in batch:
            sector = sectors_map.get(lead.sector_code)
            sector_name = sector.name if sector else (lead.sector_code or "Unknown")
            sector_config = get_sector_config(lead.sector_code) or {}

            # Merge DB sector data if available
            if sector:
                if sector.pain_points:
                    sector_config["pain_points"] = sector.pain_points
                if sector.value_props:
                    sector_config["value_props"] = sector.value_props

            batch_contexts.append(_build_lead_context(lead, sector_name, sector_config))

        # Build ICP context string
        icp_str = ""
        if icp_definition:
            icp_str = (
                f"\nTenant ICP definition:\n{json.dumps(icp_definition, indent=2)}\n"
                "Score leads higher if they match this ICP closely.\n"
            )

        user_prompt = (
            f"Score the following {len(batch_contexts)} leads.\n"
            f"{icp_str}\n"
            f"Lead data:\n{json.dumps(batch_contexts, indent=2)}\n\n"
            "For EACH lead, return a JSON object in an array with:\n"
            "- lead_id (string, must match input)\n"
            "- score (integer 0-100)\n"
            "- icp_match (string: poor | fair | good | excellent)\n"
            "- score_reason (string: 1-2 sentence explanation)\n"
            "- recommended_step (string: e.g. 'Send intro email', 'Schedule call', "
            "'Add to nurture sequence', 'Skip — low quality')\n"
            "- best_outreach_time (string: e.g. 'Tuesday 10am IST')\n"
            "- red_flags (array of strings, can be empty)\n"
            "- green_flags (array of strings, can be empty)\n\n"
            "Return ONLY a JSON array. No explanation."
        )

        # Call Claude for this batch
        raw = await claude_service.generate(
            system=SYSTEM_PROMPT,
            user_message=user_prompt,
            db=db,
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            interaction_type="lead_scoring",
        )

        scored_items = _parse_score_array(raw)

        # Map results back to leads and update DB
        scored_map = {item["lead_id"]: item for item in scored_items}

        for lead in batch:
            lead_id_str = str(lead.id)
            item = scored_map.get(lead_id_str)

            if not item:
                # Claude missed this lead — give a fallback
                logger.warning("Claude did not return score for lead %s", lead_id_str)
                item = {
                    "lead_id": lead_id_str,
                    "score": lead.lead_score or 50,
                    "icp_match": "fair",
                    "score_reason": "Could not score — insufficient AI response",
                    "recommended_step": "Review manually",
                    "best_outreach_time": "N/A",
                    "red_flags": [],
                    "green_flags": [],
                }

            score = max(0, min(100, int(item.get("score", 50))))
            icp_match = item.get("icp_match", "fair")
            if icp_match not in ("poor", "fair", "good", "excellent"):
                icp_match = "fair"

            # Update lead in DB
            lead.lead_score = score
            lead.score_reason = item.get("score_reason", "")[:500]
            lead.icp_match = icp_match

            all_results.append(
                LeadScoreResult(
                    lead_id=lead.id,
                    score=score,
                    icp_match=icp_match,
                    score_reason=item.get("score_reason", ""),
                    recommended_step=item.get("recommended_step", ""),
                    best_outreach_time=item.get("best_outreach_time", ""),
                    red_flags=item.get("red_flags", []),
                    green_flags=item.get("green_flags", []),
                )
            )

    await db.flush()

    return LeadScoreResponse(
        results=all_results,
        total_scored=len(all_results),
        tokens_used=total_tokens,
    )
