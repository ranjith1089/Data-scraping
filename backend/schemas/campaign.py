from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from typing import Optional, List
from datetime import datetime
from enum import Enum


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class CampaignChannel(str, Enum):
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    SMS = "sms"
    LINKEDIN = "linkedin"
    MULTI = "multi"


class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    sector_codes: List[str] = Field(..., min_length=1)
    channel: CampaignChannel = Field(default=CampaignChannel.EMAIL)
    segment_filter: Optional[dict] = Field(
        None, description="JSON filter criteria for lead segmentation"
    )
    daily_limit: int = Field(default=50, ge=1, le=1000)
    ai_tone: str = Field(
        default="professional",
        max_length=50,
        description="AI tone: professional, friendly, persuasive, consultative",
    )


class CampaignUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    status: Optional[CampaignStatus] = None
    sector_codes: Optional[List[str]] = None
    channel: Optional[CampaignChannel] = None
    segment_filter: Optional[dict] = None
    daily_limit: Optional[int] = Field(None, ge=1, le=1000)
    ai_tone: Optional[str] = Field(None, max_length=50)


class CampaignResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    status: str
    sector_codes: List[str]
    channel: str
    segment_filter: Optional[dict] = None
    daily_limit: int
    ai_tone: str
    total_leads: int = 0
    sent_count: int = 0
    open_count: int = 0
    reply_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CampaignStepCreate(BaseModel):
    step_number: int = Field(..., ge=1, le=20)
    channel: CampaignChannel = Field(default=CampaignChannel.EMAIL)
    delay_days: int = Field(default=0, ge=0, le=90)
    subject: Optional[str] = Field(None, max_length=500)
    body: Optional[str] = Field(None, max_length=10000)
    ai_generated: bool = Field(default=True)


class CampaignStepResponse(BaseModel):
    id: UUID
    campaign_id: UUID
    step_number: int
    channel: str
    delay_days: int
    subject: Optional[str] = None
    body: Optional[str] = None
    ai_generated: bool
    sent_count: int = 0
    open_count: int = 0
    reply_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
