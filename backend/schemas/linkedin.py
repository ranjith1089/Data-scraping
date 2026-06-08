"""Pydantic schemas for Phase 4 — LinkedIn Prospecting."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Enrich request / response
# ---------------------------------------------------------------------------


class LinkedInEnrichResponse(BaseModel):
    """Result of enriching a lead's LinkedIn profile via ProxyCurl."""

    headline: Optional[str] = None
    summary: Optional[str] = None
    skills: List[str] = []
    location: Optional[str] = None
    follower_count: Optional[int] = None
    connections: Optional[int] = None
    # Metadata
    source: str  # proxycurl | cached | no_url | no_api_key | not_found | error
    warning: Optional[str] = None


# ---------------------------------------------------------------------------
# Message generation request
# ---------------------------------------------------------------------------


class GenerateLinkedInMessageRequest(BaseModel):
    """Request body for AI-generated LinkedIn connection note + follow-up."""

    tone: str = "professional"
    # professional | friendly | value-first | curiosity
    context: Optional[str] = None  # what AveonApex/the seller offers
    include_followup: bool = True


# ---------------------------------------------------------------------------
# Message CRUD schemas
# ---------------------------------------------------------------------------


class LinkedInMessageResponse(BaseModel):
    """Full LinkedIn message record returned to the client."""

    id: UUID
    tenant_id: UUID
    lead_id: UUID
    created_by: Optional[UUID] = None

    connection_note: str
    followup_message: Optional[str] = None

    status: str
    ai_generated: bool
    ai_tone: Optional[str] = None

    linkedin_headline: Optional[str] = None
    linkedin_summary: Optional[str] = None

    sent_at: Optional[datetime] = None
    connected_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime

    # Enriched from leads join — populated by the router
    lead_company: Optional[str] = None
    lead_contact: Optional[str] = None
    lead_linkedin_url: Optional[str] = None
    lead_designation: Optional[str] = None
    lead_sector_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UpdateLinkedInMessageRequest(BaseModel):
    """Partial update — any combination of fields."""

    connection_note: Optional[str] = None
    followup_message: Optional[str] = None
    status: Optional[str] = None          # draft | sent | connected | replied | ignored
    sent_at: Optional[datetime] = None
    connected_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None
    linkedin_headline: Optional[str] = None
    linkedin_summary: Optional[str] = None
