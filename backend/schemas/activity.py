from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from typing import Optional
from datetime import datetime
from enum import Enum


class ActivityType(str, Enum):
    CALL = "call"
    EMAIL = "email"
    MEETING = "meeting"
    NOTE = "note"
    WHATSAPP = "whatsapp"
    LINKEDIN = "linkedin"
    TASK = "task"
    DEMO = "demo"
    FOLLOW_UP = "follow_up"
    OTHER = "other"


class ActivityOutcome(str, Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"
    NO_ANSWER = "no_answer"
    VOICEMAIL = "voicemail"
    CALLBACK_REQUESTED = "callback_requested"
    NOT_INTERESTED = "not_interested"
    INTERESTED = "interested"


class ActivityCreate(BaseModel):
    lead_id: UUID
    type: ActivityType
    note: Optional[str] = Field(None, max_length=5000)
    outcome: Optional[ActivityOutcome] = None
    next_action: Optional[str] = Field(None, max_length=500)
    next_action_at: Optional[datetime] = None


class ActivityUpdate(BaseModel):
    note: Optional[str] = Field(None, max_length=5000)
    outcome: Optional[ActivityOutcome] = None
    next_action: Optional[str] = Field(None, max_length=500)
    next_action_at: Optional[datetime] = None


class ActivityResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    lead_id: UUID
    user_id: UUID
    type: str
    note: Optional[str] = None
    outcome: Optional[str] = None
    next_action: Optional[str] = None
    next_action_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
