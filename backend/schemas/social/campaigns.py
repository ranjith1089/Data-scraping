"""Schemas for social campaigns + posts + templates."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# -- Posts ----------------------------------------------------------------

class SocialPostResponse(BaseModel):
    id: UUID
    platform: str
    external_post_id: str
    permalink: Optional[str] = None
    caption: Optional[str] = None
    media_url: Optional[str] = None
    posted_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -- Campaigns ------------------------------------------------------------

class SocialCampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    goal: Optional[Literal["lead_capture", "engagement", "broadcast"]] = "lead_capture"
    post_ids: List[UUID] = Field(default_factory=list)


class SocialCampaignUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[Literal["draft", "active", "paused", "archived"]] = None
    goal: Optional[Literal["lead_capture", "engagement", "broadcast"]] = None
    post_ids: Optional[List[UUID]] = None


class SocialCampaignResponse(BaseModel):
    id: UUID
    name: str
    status: str
    goal: Optional[str] = None
    posts: List[SocialPostResponse] = Field(default_factory=list)
    rule_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SocialCampaignResults(BaseModel):
    campaign_id: UUID
    dms_sent: int
    leads_created: int
    conversion_rate: float
    avg_response_time_seconds: Optional[float] = None


# -- Templates ------------------------------------------------------------

class TemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    language: Literal["en", "ta", "hi"] = "en"
    variables: List[dict[str, Any]] = Field(default_factory=list)


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    language: Optional[Literal["en", "ta", "hi"]] = None
    variables: Optional[List[dict[str, Any]]] = None


class TemplateResponse(BaseModel):
    id: UUID
    name: str
    content: str
    language: str
    variables: Optional[List[dict[str, Any]]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TemplatePreviewRequest(BaseModel):
    variables: dict[str, Any] = Field(default_factory=dict)


class TemplatePreviewResponse(BaseModel):
    rendered: str
