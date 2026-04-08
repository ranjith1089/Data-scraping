import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from core.dependencies import get_db, get_current_user
from services.claude_service import claude_service
from services.sector_config import get_sector_config
from models.lead import Lead
from models.sector import Sector
from models.user import User
from schemas.ai import EmailGenRequest, EmailGenResponse

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/generate-email", response_model=EmailGenResponse)
async def generate_email(
    req: EmailGenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Load lead
    lead = await db.get(Lead, req.lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    # 2. Load sector
    result = await db.execute(select(Sector).where(Sector.code == lead.sector_code))
    sector = result.scalar_one_or_none()
    sector_config = get_sector_config(lead.sector_code) or {}

    sector_name = sector.name if sector else lead.sector_code
    pain_points = sector.pain_points if sector else sector_config.get("pain_points", [])
    value_props = sector.value_props if sector else sector_config.get("value_props", [])

    # 3. Build system prompt
    system = (
        f"You are an expert B2B sales writer specialising in the {sector_name} sector "
        f"in India. You write {req.tone} outreach emails that resonate with "
        f"{lead.designation or 'business'} professionals at "
        f"{lead.company_size or 'mid-size'} companies. "
        f"You understand their pain points: {', '.join(pain_points or [])}.\n"
        f"Your value propositions: {', '.join(value_props or [])}.\n"
        "Always write in a way that feels personal, not templated.\n"
        "Never use generic openers like 'I hope this email finds you well'.\n"
        "Respond ONLY with valid JSON. No markdown. No explanation."
    )

    # 4. Build user prompt
    campaign_line = f"Campaign context: {req.campaign_context}" if req.campaign_context else ""
    user_prompt = (
        f"Write a step {req.step_number} cold outreach email for:\n"
        f"Company: {lead.company_name} in {lead.district or ''}, {lead.state or 'Tamil Nadu'}\n"
        f"Contact: {lead.contact_name or 'Decision Maker'}, "
        f"{lead.designation or 'Senior Executive'}\n"
        f"Product we're selling: {req.user_product_desc}\n"
        f"Tone: {req.tone}\n"
        f"{campaign_line}\n\n"
        'Output JSON:\n'
        '{\n'
        '  "subject": "...",\n'
        '  "body": "...",\n'
        '  "whatsapp_version": "...",\n'
        '  "key_hook": "...",\n'
        '  "personalisation_note": "..."\n'
        '}\n\n'
        "The whatsapp_version must be under 500 characters.\n"
        "The body should be HTML formatted with <p> tags."
    )

    # 5. Call Claude
    result = await claude_service.generate_json(
        system=system,
        user_message=user_prompt,
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        lead_id=lead.id,
        interaction_type="email_gen",
    )

    return EmailGenResponse(
        subject=result.get("subject", ""),
        body=result.get("body", ""),
        whatsapp_version=result.get("whatsapp_version", ""),
        key_hook=result.get("key_hook", ""),
        personalisation_note=result.get("personalisation_note", ""),
    )
