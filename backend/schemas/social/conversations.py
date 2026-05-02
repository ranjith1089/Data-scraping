"""Schemas for social conversations + messages."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SocialAccountResponse(BaseModel):
    id: UUID
    platform: str
    external_user_id: str
    handle: Optional[str] = None
    display_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    lead_id: Optional[UUID] = None
    first_seen_at: datetime
    last_seen_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SocialMessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    platform: str
    direction: str
    source: str
    external_message_id: Optional[str] = None
    content: Optional[str] = None
    attachments: Optional[List[dict[str, Any]]] = None
    trigger_post_id: Optional[UUID] = None
    rule_id: Optional[UUID] = None
    status: str
    error: Optional[str] = None
    received_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationResponse(BaseModel):
    id: UUID
    platform: str
    status: str
    assigned_to: Optional[UUID] = None
    last_message_at: Optional[datetime] = None
    last_message_preview: Optional[str] = None
    unread_count: int
    account: SocialAccountResponse
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationDetailResponse(ConversationResponse):
    messages: List[SocialMessageResponse]


class ConversationUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern=r"^(open|snoozed|closed)$")
    assigned_to: Optional[UUID] = None


class ManualMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class PromoteToLeadRequest(BaseModel):
    sector_code: str
    tags: List[str] = Field(default_factory=list)
