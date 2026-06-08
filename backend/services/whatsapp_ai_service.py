"""WhatsApp AI generation + phone normalisation helpers — Phase 5.

Separated from whatsapp_service.py (which owns sending logic) so the
AI generation can be tested and used independently without touching
the integration / plugin dispatch stack.
"""

from __future__ import annotations

import logging
import re
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from services.claude_service import claude_service

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Sector / tone context
# ---------------------------------------------------------------------------

_SECTOR_CONTEXT: dict[str, dict] = {
    "it_ites": {
        "sector_name": "IT & Software",
        "pain_points": "scaling engineering teams, meeting delivery deadlines, reducing hiring costs",
    },
    "education": {
        "sector_name": "Education & EdTech",
        "pain_points": "student engagement, digital learning adoption, teacher training at scale",
    },
    "marketing_media": {
        "sector_name": "Marketing & Agencies",
        "pain_points": "generating quality leads, scaling content production, improving client ROI",
    },
}

_TONE_GUIDE: dict[str, str] = {
    "friendly": (
        "Casual and warm. Use the person's first name only. "
        "Write like a peer who genuinely finds their work interesting. "
        "One optional emoji is fine — not required. No corporate jargon."
    ),
    "professional": (
        "Polished but not stiff. Respectful, concise. "
        "Reference their specific role or company. No buzzwords."
    ),
    "value-first": (
        "Lead immediately with a concrete benefit or insight. "
        "No pleasantries. Straight to the point."
    ),
    "curiosity": (
        "Open with a short question that makes them want to reply. "
        "Intrigue-based, not a pitch. Make them curious."
    ),
}


# ---------------------------------------------------------------------------
# Phone normalisation (India-aware E.164)
# ---------------------------------------------------------------------------


def normalize_phone(raw: Optional[str]) -> Optional[str]:
    """Return E.164 digits-only string for the WhatsApp Cloud API 'to' field.

    WhatsApp expects the number WITHOUT the '+', e.g. 919876543210.

    Handles common Indian formats:
      9876543210        → 919876543210  (10-digit bare mobile)
      +91 9876543210    → 919876543210
      91-9876-543-210   → 919876543210
      0091-9876543210   → 919876543210
    """
    if not raw:
        return None

    digits = re.sub(r"\D", "", raw)

    if not digits:
        return None
    if len(digits) == 10:
        return f"91{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"91{digits[1:]}"
    if len(digits) == 12 and digits.startswith("91"):
        return digits
    if len(digits) == 13 and digits.startswith("091"):
        return digits[1:]
    # Non-Indian or already full — return as-is
    return digits


# ---------------------------------------------------------------------------
# AI message generation
# ---------------------------------------------------------------------------


async def generate_message(
    *,
    lead_name: str,
    lead_company: str,
    lead_designation: Optional[str],
    lead_sector: str,
    tone: str,
    context: Optional[str],
    db: AsyncSession,
    tenant_id: UUID,
    user_id: Optional[UUID],
    lead_id: Optional[UUID],
) -> dict:
    """AI-generate a short WhatsApp cold opener.

    Returns: { content: str, char_count: int, tone: str }
    """
    sector_ctx = _SECTOR_CONTEXT.get(lead_sector, {
        "sector_name": lead_sector,
        "pain_points": "business growth and operational efficiency",
    })
    tone_guide = _TONE_GUIDE.get(tone, _TONE_GUIDE["friendly"])

    context_line = (
        f"What we offer: {context.strip()}"
        if context and context.strip()
        else "We help Indian businesses grow through technology and smart sales strategies."
    )

    system_prompt = (
        "You are a B2B sales expert writing WhatsApp cold outreach for the Indian market. "
        "WhatsApp is personal and conversational — not a broadcast channel for copy-paste pitches. "
        "Decision-makers reply to messages that feel human and immediately relevant. "
        "Your goal is a reply, not a sale."
    )

    user_message = f"""Write a WhatsApp cold outreach message for this lead:

LEAD
- Name: {lead_name}
- Company: {lead_company}
- Title: {lead_designation or sector_ctx['sector_name'] + ' decision-maker'}
- Sector: {sector_ctx['sector_name']}
- Common pain points: {sector_ctx['pain_points']}

OFFER
{context_line}

TONE
{tone_guide}

STRICT RULES
- Maximum 200 characters (short = more replies on WhatsApp)
- Use their first name only
- NO generic openers ("I hope you're doing well", "I came across your profile")
- End with a soft question or hook — NOT "Let's schedule a call" on first message
- Plain text only — no markdown, asterisks, bullet points, or HTML
- Do not mention the character limit in the message

Return JSON only:
{{
  "content": "the message text here",
  "char_count": <integer>
}}"""

    result = await claude_service.generate_json(
        system=system_prompt,
        user_message=user_message,
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        lead_id=lead_id,
        interaction_type="whatsapp_message_gen",
    )

    content = str(result.get("content", "")).strip()
    # Hard cap — WhatsApp free-form text limit is 4096 chars; we target 200
    if len(content) > 1024:
        content = content[:1021] + "..."

    return {"content": content, "char_count": len(content), "tone": tone}
