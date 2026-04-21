"""Vernacular AI copy generator — English / Tamil / Hindi.

GAP 5. Takes a lightweight context (business type + audience + tone)
and returns SMS / WhatsApp / Email drafts in the requested language.
Runs through the same provider-agnostic claude_service.generate_json
facade as every other AI feature, so the generated copy shows up in
the AI Usage dashboard under ``interaction_type="vernacular_copy"``.

Prompts keep placeholders ({{company_name}} / {{contact_name}}) in
Latin script regardless of language, so the campaign runner's regex
interpolation still works for Tamil/Hindi sends.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from models.user import User
from schemas.ai import VernacularGenerateRequest, VernacularGenerateResponse
from services.claude_service import claude_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])


_LANG_NAMES = {"en": "English", "ta": "Tamil (தமிழ்)", "hi": "Hindi (हिन्दी)"}


_SYSTEM_RULES = {
    "en": (
        "You write B2B sales copy in natural, professional English for "
        "the Indian market. Keep language simple and direct. Avoid "
        "overused phrases like 'I hope this email finds you well'."
    ),
    "ta": (
        "You write B2B sales copy in natural, respectful Tamil (தமிழ்) "
        "for Tamil Nadu. Use appropriate honorifics (திரு. / திருமதி. / "
        "ஐயா / அம்மா) depending on context. Read like a native speaker, "
        "not a machine translation. Never mix English words unless they "
        "are accepted technical terms (email, demo, API, WhatsApp)."
    ),
    "hi": (
        "You write B2B sales copy in natural, polite Hindi (हिन्दी) for "
        "North India. Use आप-form (respectful). Read like a native "
        "speaker. Never mix English words unless they are accepted "
        "technical terms (email, demo, API, WhatsApp)."
    ),
}

_GLOBAL_RULES = (
    "Always keep placeholders {{company_name}} and {{contact_name}} in "
    "Latin script exactly as shown. These get substituted at send time. "
    "Return ONLY valid JSON — no markdown, no prose, no explanations."
)


@router.post("/generate-vernacular", response_model=VernacularGenerateResponse)
async def generate_vernacular(
    req: VernacularGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lang_code = req.language
    lang_name = _LANG_NAMES.get(lang_code, "English")
    rules = _SYSTEM_RULES.get(lang_code, _SYSTEM_RULES["en"])
    channels = [req.channel] if req.channel else ["sms", "whatsapp", "email"]

    # Build per-channel output spec. Keep the whole thing in ONE AI call
    # so users who want all three channels don't pay for three round-trips.
    output_spec_parts = []
    if "sms" in channels:
        output_spec_parts.append(
            '"sms": "single line, <160 characters, plain text, no HTML, '
            'use {{contact_name}} naturally"'
        )
    if "whatsapp" in channels:
        output_spec_parts.append(
            '"whatsapp": "<500 characters, natural {lang} with optional emojis, '
            'use both {{company_name}} and {{contact_name}}"'.replace("{lang}", lang_name)
        )
    if "email" in channels:
        output_spec_parts.append(
            '"email_subject": "<80 chars, no greeting, hook + clear value"'
        )
        output_spec_parts.append(
            '"email_body": "HTML with <p> tags, 3–5 short paragraphs, '
            'open with a personalised line, end with a clear single CTA"'
        )
    output_spec = "{\n  " + ",\n  ".join(output_spec_parts) + "\n}"

    user_prompt = (
        f"Language: {lang_name} ({lang_code})\n"
        f"Business type: {req.business_type}\n"
        f"Target audience: {req.audience}\n"
        f"Tone: {req.tone}\n\n"
        f"Write outreach copy that a {lang_name} sales rep would actually send. "
        f"Use {{{{contact_name}}}} and {{{{company_name}}}} placeholders. "
        "Keep it concrete and benefit-focused.\n\n"
        f"Output JSON:\n{output_spec}"
    )

    system_prompt = f"{rules}\n{_GLOBAL_RULES}"

    result: Dict[str, Any] = await claude_service.generate_json(
        system=system_prompt,
        user_message=user_prompt,
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        interaction_type="vernacular_copy",
    )

    def _get(key: str) -> str | None:
        v = result.get(key)
        return str(v) if v else None

    return VernacularGenerateResponse(
        language=lang_code,
        sms=_get("sms") if "sms" in channels else None,
        whatsapp=_get("whatsapp") if "whatsapp" in channels else None,
        email_subject=_get("email_subject") if "email" in channels else None,
        email_body=_get("email_body") if "email" in channels else None,
    )
