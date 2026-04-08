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
from models.campaign_step import CampaignStep
from models.user import User
from schemas.ai import PersonaliseRequest, PersonaliseResponse, PersonalisedEmail

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])

BATCH_SIZE = 10

SYSTEM_PROMPT = (
    "You are a B2B email personalisation expert for the Indian market. "
    "Given a template email and lead data, create a personalised version that:\n"
    "- Opens with a company-specific line referencing their industry, location, or role\n"
    "- References a relevant pain point for their sector\n"
    "- Includes a local reference (city, district, or state) when available\n"
    "- Keeps the core message and CTA intact\n"
    "- Feels like a 1:1 email, not a mail merge\n"
    "Respond ONLY with valid JSON array. No markdown. No explanation."
)


def _parse_personalise_array(raw: str) -> list[dict]:
    """Parse a JSON array from Claude response."""
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
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            try:
                parsed = json.loads(text[start:end])
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass
        logger.error("Failed to parse personalise array: %s", text[:300])
        raise ValueError("Could not parse JSON array from Claude response")


@router.post("/personalise-batch", response_model=PersonaliseResponse)
async def personalise_batch(
    req: PersonaliseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not req.lead_ids:
        raise HTTPException(400, "No lead IDs provided")

    if len(req.lead_ids) > 50:
        raise HTTPException(400, "Maximum 50 leads per personalisation request")

    # Load campaign step template
    step = await db.get(CampaignStep, req.campaign_step_id)
    if not step:
        raise HTTPException(404, "Campaign step not found")

    if not step.subject and not step.body:
        raise HTTPException(400, "Campaign step has no email template to personalise")

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

    # Preserve request order
    ordered_leads = [leads[lid] for lid in req.lead_ids if lid in leads]

    # Pre-load sectors
    sector_codes = {l.sector_code for l in ordered_leads if l.sector_code}
    sectors_map: dict[str, Sector] = {}
    if sector_codes:
        sectors_result = await db.execute(
            select(Sector).where(Sector.code.in_(sector_codes))
        )
        sectors_map = {s.code: s for s in sectors_result.scalars().all()}

    all_emails: list[PersonalisedEmail] = []
    total_tokens = 0

    for i in range(0, len(ordered_leads), BATCH_SIZE):
        batch = ordered_leads[i : i + BATCH_SIZE]

        leads_context = []
        for lead in batch:
            sector = sectors_map.get(lead.sector_code)
            sector_config = get_sector_config(lead.sector_code) or {}
            sector_name = sector.name if sector else sector_config.get("name", lead.sector_code or "Unknown")
            pain_points = (
                (sector.pain_points if sector and sector.pain_points else None)
                or sector_config.get("pain_points", [])
            )

            leads_context.append({
                "lead_id": str(lead.id),
                "company_name": lead.company_name,
                "contact_name": lead.contact_name or "Decision Maker",
                "designation": lead.designation or "Senior Executive",
                "sector_name": sector_name,
                "industry": lead.industry,
                "city": lead.city,
                "district": lead.district,
                "state": lead.state or "Tamil Nadu",
                "company_size": lead.company_size,
                "pain_points": pain_points[:3] if pain_points else [],
                "website": lead.website,
                "tags": lead.tags or [],
            })

        user_prompt = (
            f"Personalise this email template for {len(leads_context)} leads.\n\n"
            f"TEMPLATE:\n"
            f"Subject: {step.subject or '(no subject)'}\n"
            f"Body:\n{step.body or '(no body)'}\n\n"
            f"LEADS:\n{json.dumps(leads_context, indent=2)}\n\n"
            "For EACH lead return a JSON object in an array:\n"
            "[\n"
            "  {\n"
            '    "lead_id": "...",\n'
            '    "subject": "personalised subject line",\n'
            '    "body": "full personalised email body in HTML with <p> tags",\n'
            '    "personalised_opening": "the custom opening line you crafted"\n'
            "  }\n"
            "]\n\n"
            "Return ONLY the JSON array."
        )

        raw = await claude_service.generate(
            system=SYSTEM_PROMPT,
            user_message=user_prompt,
            db=db,
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            interaction_type="personalise",
        )

        personalised_items = _parse_personalise_array(raw)
        personalised_map = {item["lead_id"]: item for item in personalised_items}

        for lead in batch:
            lead_id_str = str(lead.id)
            item = personalised_map.get(lead_id_str)

            if not item:
                logger.warning(
                    "Claude did not return personalisation for lead %s", lead_id_str
                )
                # Fallback: use template as-is with basic name replacement
                fallback_subject = (step.subject or "").replace(
                    "{{name}}", lead.contact_name or "there"
                )
                fallback_body = (step.body or "").replace(
                    "{{name}}", lead.contact_name or "there"
                ).replace(
                    "{{company}}", lead.company_name
                )
                item = {
                    "lead_id": lead_id_str,
                    "subject": fallback_subject,
                    "body": fallback_body,
                    "personalised_opening": "",
                }

            all_emails.append(
                PersonalisedEmail(
                    lead_id=lead.id,
                    subject=item.get("subject", step.subject or ""),
                    body=item.get("body", step.body or ""),
                    personalised_opening=item.get("personalised_opening", ""),
                )
            )

    return PersonaliseResponse(
        emails=all_emails,
        tokens_used=total_tokens,
    )
