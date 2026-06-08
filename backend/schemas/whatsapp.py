"""Pydantic schemas for Phase 5 — WhatsApp Outreach."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Message generate / send requests
# ---------------------------------------------------------------------------


class GenerateWhatsAppMessageRequest(BaseModel):
    tone: str = "friendly"
    # friendly | professional | value-first | curiosity
    context: Optional[str] = None  # what you're offering


class SendWhatsAppMessageRequest(BaseModel):
    content: str
    message_type: str = "manual"  # manual | ai_generated | template
    template_name: Optional[str] = None
    ai_tone: Optional[str] = None


# ---------------------------------------------------------------------------
# Message response
# ---------------------------------------------------------------------------


class WhatsAppMessageResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    lead_id: UUID
    created_by: Optional[UUID] = None

    direction: str
    message_type: str
    content: str
    template_name: Optional[str] = None

    status: str
    wa_message_id: Optional[str] = None
    error_message: Optional[str] = None
    phone_number: Optional[str] = None
    ai_tone: Optional[str] = None

    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime

    # Enriched from leads join
    lead_company: Optional[str] = None
    lead_contact: Optional[str] = None
    lead_phone: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Generate response (before saving / sending)
# ---------------------------------------------------------------------------


class GeneratedWhatsAppMessage(BaseModel):
    content: str
    char_count: int
    tone: str
    warning: Optional[str] = None  # e.g. "no phone number on this lead"


# ---------------------------------------------------------------------------
# Send result
# ---------------------------------------------------------------------------


class SendWhatsAppResult(BaseModel):
    success: bool
    message_id: Optional[str] = None   # our DB id
    wa_message_id: Optional[str] = None  # WhatsApp's wamid
    status: str
    warning: Optional[str] = None


# ---------------------------------------------------------------------------
# Thread response (conversation per lead)
# ---------------------------------------------------------------------------


class WhatsAppThread(BaseModel):
    lead_id: UUID
    lead_company: str
    lead_contact: Optional[str] = None
    lead_phone: Optional[str] = None
    messages: List[WhatsAppMessageResponse]
    unread_count: int = 0
    last_message_at: Optional[datetime] = None
