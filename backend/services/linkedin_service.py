"""LinkedIn Prospecting Service — Phase 4.

Two responsibilities:
  1. Profile enrichment via ProxyCurl (optional — graceful if no API key).
  2. AI-generated LinkedIn messages via claude_service.generate_json.

ProxyCurl API reference: https://nubela.co/proxycurl/docs
  GET /proxycurl/api/v2/linkedin  →  Person Lookup by LinkedIn URL
  Pricing: 1 credit per person lookup (~$0.01 on pay-as-you-go).
  Free trial: 10 credits at sign-up.
"""

from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from services.claude_service import claude_service

logger = logging.getLogger(__name__)

_PROXYCURL_PERSON_URL = "https://nubela.co/proxycurl/api/v2/linkedin"
_HTTP_TIMEOUT = 15.0

# ---------------------------------------------------------------------------
# Sector-aware tone personas
# ---------------------------------------------------------------------------

_SECTOR_CONTEXT: dict[str, dict] = {
    "it_ites": {
        "sector_name": "IT & Software Services",
        "buyer_title": "CTO / VP Engineering / Founder",
        "pain_points": "scaling tech teams, project delivery speed, legacy integrations",
    },
    "education": {
        "sector_name": "Education & EdTech",
        "buyer_title": "Principal / Director / Head of L&D",
        "pain_points": "student engagement, digital learning adoption, teacher training",
    },
    "marketing_media": {
        "sector_name": "Marketing & Agencies",
        "buyer_title": "Founder / CMO / Creative Director",
        "pain_points": "lead generation ROI, content scale, client retention",
    },
}

_TONE_GUIDE: dict[str, str] = {
    "professional": (
        "Concise, respectful and credibility-first. Reference their role and company. "
        "Do not use buzzwords or filler phrases like 'I hope this message finds you well'."
    ),
    "friendly": (
        "Warm and approachable. First-name basis. Light and conversational tone. "
        "Like reaching out to a peer you admire, not a cold prospect."
    ),
    "value-first": (
        "Lead immediately with a specific value statement or insight relevant to their "
        "company or sector. No pleasantries — straight to the point."
    ),
    "curiosity": (
        "Open with a question or observation that makes them curious. "
        "Intrigue-based, not pitch-based. Leaves them wanting to know more."
    ),
}


# ---------------------------------------------------------------------------
# ProxyCurl enrichment
# ---------------------------------------------------------------------------


async def enrich_profile(linkedin_url: str) -> dict:
    """Fetch a LinkedIn profile via ProxyCurl.

    Returns a dict suitable for storing as ``linkedin_profile_snapshot`` and
    extracting headline/summary. Gracefully returns partial data on errors.
    """
    if not settings.PROXYCURL_API_KEY:
        return {
            "source": "no_api_key",
            "warning": (
                "PROXYCURL_API_KEY is not set. "
                "Sign up at https://nubela.co/proxycurl to enable LinkedIn profile enrichment."
            ),
        }

    if not linkedin_url or "linkedin.com" not in linkedin_url:
        return {"source": "no_url", "warning": "No valid LinkedIn URL on this lead."}

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.get(
                _PROXYCURL_PERSON_URL,
                params={"url": linkedin_url, "use_cache": "if-present"},
                headers={"Authorization": f"Bearer {settings.PROXYCURL_API_KEY}"},
            )
    except httpx.TimeoutException:
        return {"source": "error", "warning": "ProxyCurl request timed out."}
    except Exception as exc:  # noqa: BLE001
        logger.exception("[linkedin] ProxyCurl request error: %s", exc)
        return {"source": "error", "warning": f"ProxyCurl error: {exc}"}

    if resp.status_code == 401:
        return {"source": "error", "warning": "ProxyCurl API key is invalid or expired."}
    if resp.status_code == 404:
        return {"source": "not_found", "warning": "LinkedIn profile not found on ProxyCurl."}
    if resp.status_code == 429:
        return {"source": "error", "warning": "ProxyCurl rate limit reached. Try again later."}
    if resp.status_code != 200:
        return {
            "source": "error",
            "warning": f"ProxyCurl returned HTTP {resp.status_code}.",
        }

    data = resp.json()
    logger.info("[linkedin] ProxyCurl enriched: %s", linkedin_url[:60])

    # Extract the fields we care about
    skills = [s.get("name", "") for s in (data.get("skills") or []) if s.get("name")]
    return {
        "source": "proxycurl",
        "headline": data.get("headline"),
        "summary": data.get("summary"),
        "location": data.get("city") or data.get("country_full_name"),
        "follower_count": data.get("follower_count"),
        "connections": data.get("connections"),
        "skills": skills[:15],  # cap
        "profile_pic_url": data.get("profile_pic_url"),
        "full_name": data.get("full_name"),
        "current_company": (
            (data.get("experiences") or [{}])[0].get("company")
            if data.get("experiences")
            else None
        ),
    }


# ---------------------------------------------------------------------------
# AI message generation
# ---------------------------------------------------------------------------


async def generate_messages(
    *,
    lead_name: str,
    lead_company: str,
    lead_designation: Optional[str],
    lead_sector: str,
    linkedin_headline: Optional[str],
    linkedin_summary: Optional[str],
    skills: list[str],
    tone: str,
    context: Optional[str],
    include_followup: bool,
    db: AsyncSession,
    tenant_id: UUID,
    user_id: Optional[UUID],
    lead_id: Optional[UUID],
) -> dict:
    """Generate a LinkedIn connection note (≤300 chars) and optional follow-up
    using claude_service.generate_json().

    Returns dict: { connection_note, followup_message, note_char_count }
    """
    sector_ctx = _SECTOR_CONTEXT.get(lead_sector, {
        "sector_name": lead_sector,
        "buyer_title": lead_designation or "decision-maker",
        "pain_points": "business growth and operational efficiency",
    })
    tone_guide = _TONE_GUIDE.get(tone, _TONE_GUIDE["professional"])

    # Build the profile snippet
    profile_lines = []
    if linkedin_headline:
        profile_lines.append(f"LinkedIn headline: {linkedin_headline}")
    if linkedin_summary:
        profile_lines.append(
            f"LinkedIn summary (first 200 chars): {linkedin_summary[:200]}"
        )
    if skills:
        profile_lines.append(f"Skills/expertise: {', '.join(skills[:8])}")
    profile_section = "\n".join(profile_lines) if profile_lines else "(no LinkedIn data available)"

    context_section = (
        f"What we're offering: {context.strip()}"
        if context and context.strip()
        else "We provide B2B sales and marketing solutions for Indian businesses."
    )

    system_prompt = (
        "You are a B2B LinkedIn outreach expert specialising in the Indian market. "
        "You write short, highly personalised LinkedIn messages that feel human — "
        "not like mass-sent templates. You know that decision-makers in India respond "
        "best to messages that reference their specific context, show genuine interest, "
        "and don't pitch hard in the first message."
    )

    user_message = f"""Generate LinkedIn outreach messages for this lead:

LEAD DETAILS
- Name: {lead_name}
- Company: {lead_company}
- Role/Title: {lead_designation or sector_ctx['buyer_title']}
- Sector: {sector_ctx['sector_name']}

LINKEDIN PROFILE DATA
{profile_section}

WHAT WE OFFER
{context_section}

TONE INSTRUCTION
{tone_guide}

REQUIREMENTS
1. connection_note: LinkedIn connection request note. STRICT LIMIT: 300 characters including spaces.
   - Address them by first name only.
   - Reference something specific about their role, company or LinkedIn data.
   - Do NOT use generic openers like "I came across your profile" or "I hope this finds you well".
   - Do NOT mention the character limit in the note itself.

2. followup_message: A follow-up message to send after they accept the connection.
   - 3-4 sentences maximum.
   - Start by briefly acknowledging the connection.
   - Offer a specific value or insight relevant to their sector pain points: {sector_ctx['pain_points']}.
   - End with a soft, open-ended question — NOT a request for a call immediately.
   {f"- Set include_followup to false if the user only wants a connection note." if not include_followup else ""}

Respond in this exact JSON format:
{{
  "connection_note": "...",
  "followup_message": {"null" if not include_followup else '"..."'},
  "note_char_count": <integer>
}}"""

    try:
        result = await claude_service.generate_json(
            system=system_prompt,
            user_message=user_message,
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            lead_id=lead_id,
            interaction_type="linkedin_message_gen",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("[linkedin] AI generation failed: %s", exc)
        raise

    # Enforce the 300-char hard limit as a safety net
    note = str(result.get("connection_note", "")).strip()
    if len(note) > 300:
        note = note[:297] + "..."

    followup = None
    if include_followup:
        followup = result.get("followup_message") or None
        if followup:
            followup = str(followup).strip()

    return {
        "connection_note": note,
        "followup_message": followup,
        "note_char_count": len(note),
    }
