from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID


class EmailGenRequest(BaseModel):
    lead_id: UUID
    step_number: int = Field(default=1, ge=1, le=10)
    tone: str = Field(default="professional", max_length=50)
    campaign_context: Optional[str] = Field(None, max_length=2000)
    user_product_desc: str = Field(..., min_length=10, max_length=5000)


class EmailGenResponse(BaseModel):
    subject: str
    body: str
    whatsapp_version: str
    key_hook: str
    personalisation_note: str


class LeadScoreRequest(BaseModel):
    lead_ids: List[UUID] = Field(..., max_length=50)


class LeadScoreResult(BaseModel):
    lead_id: UUID
    score: int = Field(..., ge=0, le=100)
    icp_match: str = Field(
        ..., description="ICP match level: poor | fair | good | excellent"
    )
    score_reason: str
    recommended_step: str
    best_outreach_time: str
    red_flags: List[str] = Field(default_factory=list)
    green_flags: List[str] = Field(default_factory=list)


class LeadScoreResponse(BaseModel):
    results: List[LeadScoreResult]
    total_scored: int
    tokens_used: int


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    lead_id: Optional[UUID] = None
    conversation_history: List[dict] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    suggestions: List[str] = Field(default_factory=list)
    tokens_used: int = 0


class SectorBriefResponse(BaseModel):
    sector_code: str
    sector_name: str
    brief: str
    generated_at: str


class PersonaliseRequest(BaseModel):
    lead_ids: List[UUID] = Field(..., min_length=1, max_length=50)
    campaign_step_id: UUID


class PersonalisedEmail(BaseModel):
    lead_id: UUID
    subject: str
    body: str
    personalised_opening: str


class PersonaliseResponse(BaseModel):
    emails: List[PersonalisedEmail]
    tokens_used: int


class ReplyAnalyseRequest(BaseModel):
    reply_text: str = Field(..., min_length=1, max_length=10000)
    lead_id: UUID


class ReplyAnalyseResponse(BaseModel):
    sentiment: str = Field(
        ...,
        description="Sentiment: positive | neutral | negative | out_of_office",
    )
    intent: str = Field(
        ...,
        description=(
            "Intent: interested | not_interested | asking_for_info | "
            "wants_demo | unsubscribe | referring_someone"
        ),
    )
    suggested_response: str
    stage_recommendation: str
    confidence: float = Field(..., ge=0, le=1)
