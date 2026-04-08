import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models.lead import Lead
from models.campaign import Campaign
from models.user import User
from core.dependencies import get_db, get_current_user
from services.claude_service import claude_service
from schemas.ai import ChatRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/chat")
async def ai_chat(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Build context — aggregate stats
    total_leads = (
        await db.scalar(
            select(func.count(Lead.id)).where(Lead.tenant_id == current_user.tenant_id)
        )
        or 0
    )
    active_campaigns = (
        await db.scalar(
            select(func.count(Campaign.id)).where(
                Campaign.tenant_id == current_user.tenant_id,
                Campaign.status == "active",
            )
        )
        or 0
    )

    # Get top hot leads for context
    hot_leads_result = await db.execute(
        select(Lead)
        .where(Lead.tenant_id == current_user.tenant_id, Lead.lead_score >= 70)
        .order_by(Lead.lead_score.desc())
        .limit(5)
    )
    hot_leads = hot_leads_result.scalars().all()
    hot_leads_str = (
        "\n".join(
            [
                f"- {l.company_name} ({l.sector_code}, score: {l.lead_score}, "
                f"{l.contact_name or 'N/A'} - {l.designation or 'N/A'})"
                for l in hot_leads
            ]
        )
        or "No hot leads yet"
    )

    # If lead context provided, add it
    lead_context = ""
    if req.lead_id:
        lead = await db.get(Lead, req.lead_id)
        if lead:
            lead_context = (
                f"\nCurrent lead context:\n"
                f"- Company: {lead.company_name}\n"
                f"- Sector: {lead.sector_code}\n"
                f"- Contact: {lead.contact_name} ({lead.designation})\n"
                f"- Score: {lead.lead_score} ({lead.icp_match or 'not scored'})\n"
                f"- Stage: {lead.stage}\n"
                f"- Location: {lead.city or ''}, {lead.district or ''}, {lead.state or ''}\n"
                f"- Email: {lead.email or 'N/A'}\n"
                f"- Phone: {lead.phone or 'N/A'}\n"
            )

    # Full-text search for relevant leads based on query
    relevant_str = ""
    try:
        search_results = await db.execute(
            select(Lead)
            .where(
                Lead.tenant_id == current_user.tenant_id,
                func.to_tsvector(
                    "english",
                    func.coalesce(Lead.company_name, "")
                    + " "
                    + func.coalesce(Lead.contact_name, "")
                    + " "
                    + func.coalesce(Lead.industry, "")
                    + " "
                    + func.coalesce(Lead.city, ""),
                ).match(req.message),
            )
            .limit(10)
        )
        relevant_leads = search_results.scalars().all()
        if relevant_leads:
            relevant_str = "\nRelevant leads from search:\n" + "\n".join(
                [
                    f"- {l.company_name} | {l.sector_code} | "
                    f"{l.contact_name} ({l.designation}) | "
                    f"Score: {l.lead_score} | Stage: {l.stage} | {l.district or ''}"
                    for l in relevant_leads
                ]
            )
    except Exception:
        # Full-text search may fail if query has special chars; degrade gracefully
        logger.debug("Full-text search failed for chat query, skipping", exc_info=True)

    system = (
        "You are LeadForge AI, a sales intelligence assistant for a B2B sales team "
        "in India. You have access to their lead database and campaign metrics. "
        "You help sales reps:\n"
        "- Find the right leads to contact today\n"
        "- Understand a company before a call\n"
        "- Draft follow-up messages\n"
        "- Analyse why campaigns are or aren't working\n"
        "- Give sector-specific market intelligence\n\n"
        f"Current tenant info:\n"
        f"Total leads: {total_leads}\n"
        f"Active campaigns: {active_campaigns}\n"
        f"Today's priority leads (highest scores):\n{hot_leads_str}\n"
        f"{lead_context}"
        f"{relevant_str}\n\n"
        f"User: {current_user.full_name} ({current_user.role})\n\n"
        "Be concise, actionable, and data-driven. "
        "Use bullet points when listing leads or recommendations."
    )

    # Build messages with conversation history (last 10 messages)
    messages = []
    for msg in req.conversation_history[-10:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": req.message})

    # Stream response
    async def event_stream():
        try:
            async for text in claude_service.generate_stream(
                system=system,
                user_message=req.message,
                db=db,
                tenant_id=current_user.tenant_id,
                user_id=current_user.id,
                lead_id=req.lead_id,
                interaction_type="chat",
                messages=messages,
            ):
                yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error("Chat stream error: %s", e, exc_info=True)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
