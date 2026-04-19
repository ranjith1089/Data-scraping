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
from schemas.ai import (
    EmailGenRequest,
    EmailGenResponse,
    EmailTemplateRequest,
    EmailTemplateResponse,
)

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


@router.post("/generate-email-template", response_model=EmailTemplateResponse)
async def generate_email_template(
    req: EmailTemplateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a reusable campaign step template (no specific lead).

    Unlike ``/generate-email`` which personalises for one lead, this
    endpoint returns copy with ``{{company_name}}`` and ``{{contact_name}}``
    placeholders that the campaign runner interpolates at send time.
    Used by the campaign builder's "Generate with AI" button on each
    step in the sequence.
    """
    # Load sector context if a sector_code is supplied
    sector_name: str = "B2B"
    pain_points: list[str] = []
    value_props: list[str] = []
    if req.sector_code:
        sector_config = get_sector_config(req.sector_code) or {}
        result_s = await db.execute(select(Sector).where(Sector.code == req.sector_code))
        sector = result_s.scalar_one_or_none()
        sector_name = (sector.name if sector else None) or sector_config.get("name") or req.sector_code
        pain_points = (sector.pain_points if sector else None) or sector_config.get("pain_points", [])
        value_props = (sector.value_props if sector else None) or sector_config.get("value_props", [])

    channel_hint = (
        "short WhatsApp message (under 500 characters, no subject line, no HTML)"
        if req.channel == "whatsapp"
        else "cold outreach email with subject line and HTML body"
    )

    system = (
        f"You are an expert B2B {sector_name} sales writer for the Indian market. "
        f"You write {req.tone} campaign templates that the sender will merge with "
        "real lead data at send time. Use the placeholders {{company_name}} and "
        "{{contact_name}} wherever personalisation should happen. Do NOT invent "
        "real company names, revenues, or statistics. Respond ONLY with valid "
        "JSON. No markdown, no prose, no explanations."
    )
    if pain_points:
        system += f"\nKnown sector pain points: {', '.join(pain_points[:6])}."
    if value_props:
        system += f"\nValue propositions: {', '.join(value_props[:6])}."

    step_intent = (
        "first-touch outreach"
        if req.step_number == 1
        else f"follow-up #{req.step_number - 1}"
    )

    description_line = (
        f"Campaign description: {req.campaign_description}\n"
        if req.campaign_description
        else ""
    )
    product_line = (
        f"Product / offer: {req.product_description}\n"
        if req.product_description
        else "Product / offer: (not specified — stay generic about what's offered)\n"
    )

    user_prompt = (
        f"Write a {step_intent} {channel_hint} template.\n"
        f"Target sector: {sector_name}\n"
        f"Tone: {req.tone}\n"
        f"Step number: {req.step_number}\n"
        f"{description_line}"
        f"{product_line}\n"
        "Requirements:\n"
        "- Use {{company_name}} and {{contact_name}} placeholders where personalisation belongs.\n"
        "- Keep it specific to the sector's real pain points (never generic 'I hope this finds you well').\n"
        "- If step_number > 1, acknowledge this is a follow-up.\n\n"
        + (
            'Output JSON:\n{\n  "whatsapp_version": "..."\n}\n'
            "The whatsapp_version must be under 500 characters."
            if req.channel == "whatsapp"
            else
            'Output JSON:\n'
            '{\n'
            '  "subject": "...",\n'
            '  "body": "...",\n'
            '  "whatsapp_version": "..."\n'
            '}\n'
            "The body should be HTML with <p> tags. The whatsapp_version "
            "must be under 500 characters."
        )
    )

    result = await claude_service.generate_json(
        system=system,
        user_message=user_prompt,
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        interaction_type="email_template",
    )

    if req.channel == "whatsapp":
        body = result.get("whatsapp_version") or result.get("body") or ""
        return EmailTemplateResponse(
            subject="",  # WhatsApp has no subject
            body=body,
            whatsapp_version=body,
        )

    return EmailTemplateResponse(
        subject=result.get("subject", ""),
        body=result.get("body", ""),
        whatsapp_version=result.get("whatsapp_version"),
    )
