import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.dependencies import get_db, get_current_user
from services.claude_service import claude_service
from services.sector_config import get_sector_config
from models.lead import Lead
from models.sector import Sector
from models.user import User
from schemas.ai import ReplyAnalyseRequest, ReplyAnalyseResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])

SYSTEM_PROMPT = (
    "You are a sales email analyst for a B2B sales team in India. "
    "Analyze the reply and determine the sender's sentiment and intent. "
    "Be precise — correctly distinguishing between 'interested' and 'asking_for_info' "
    "is critical for the sales workflow. "
    "Respond ONLY with valid JSON. No markdown. No explanation."
)


@router.post("/analyse-reply", response_model=ReplyAnalyseResponse)
async def analyse_reply(
    req: ReplyAnalyseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Load lead for context
    lead = await db.get(Lead, req.lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")

    # Load sector context
    sector_name = lead.sector_code or "Unknown"
    sector_config = get_sector_config(lead.sector_code) or {}

    if lead.sector_code:
        result = await db.execute(
            select(Sector).where(Sector.code == lead.sector_code)
        )
        sector = result.scalar_one_or_none()
        if sector:
            sector_name = sector.name

    user_prompt = (
        "Analyse this email reply from a prospect.\n\n"
        f"LEAD CONTEXT:\n"
        f"- Company: {lead.company_name}\n"
        f"- Contact: {lead.contact_name or 'Unknown'} ({lead.designation or 'Unknown'})\n"
        f"- Sector: {sector_name}\n"
        f"- Current stage: {lead.stage}\n"
        f"- Lead score: {lead.lead_score}\n"
        f"- Location: {lead.city or ''}, {lead.district or ''}, {lead.state or ''}\n\n"
        f"REPLY TEXT:\n---\n{req.reply_text}\n---\n\n"
        "Output JSON:\n"
        "{\n"
        '  "sentiment": "positive | neutral | negative | out_of_office",\n'
        '  "intent": "interested | not_interested | asking_for_info | wants_demo | '
        'unsubscribe | referring_someone",\n'
        '  "suggested_response": "A brief suggested reply or next action (2-3 sentences)",\n'
        '  "stage_recommendation": "The pipeline stage this lead should move to '
        '(e.g. qualified, demo_scheduled, nurture, lost, replied)",\n'
        '  "confidence": 0.0 to 1.0\n'
        "}\n\n"
        "Be accurate with sentiment. An out-of-office auto-reply is 'out_of_office', "
        "not 'negative'. A polite 'not now' is 'neutral' + 'not_interested'."
    )

    result = await claude_service.generate_json(
        system=SYSTEM_PROMPT,
        user_message=user_prompt,
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        lead_id=lead.id,
        interaction_type="reply_analysis",
    )

    # Validate and normalise values
    sentiment = result.get("sentiment", "neutral")
    valid_sentiments = {"positive", "neutral", "negative", "out_of_office"}
    if sentiment not in valid_sentiments:
        sentiment = "neutral"

    intent = result.get("intent", "asking_for_info")
    valid_intents = {
        "interested",
        "not_interested",
        "asking_for_info",
        "wants_demo",
        "unsubscribe",
        "referring_someone",
    }
    if intent not in valid_intents:
        intent = "asking_for_info"

    confidence = result.get("confidence", 0.5)
    try:
        confidence = float(confidence)
        confidence = max(0.0, min(1.0, confidence))
    except (TypeError, ValueError):
        confidence = 0.5

    return ReplyAnalyseResponse(
        sentiment=sentiment,
        intent=intent,
        suggested_response=result.get("suggested_response", ""),
        stage_recommendation=result.get("stage_recommendation", "replied"),
        confidence=confidence,
    )
