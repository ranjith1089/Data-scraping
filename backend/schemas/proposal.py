"""Pydantic schemas for the Proposals module."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProposalGenerateRequest(BaseModel):
    lead_id: UUID
    # service_proposal | project_quote | intro_letter
    proposal_type: str = "service_proposal"
    # professional | friendly | formal | consultative
    tone: str = "professional"
    # Optional override — what AveonApex is selling for this specific pitch
    product_description: Optional[str] = None


class ProposalUpdateRequest(BaseModel):
    title: Optional[str] = None
    # draft | sent | accepted | rejected
    status: Optional[str] = None
    content_markdown: Optional[str] = None
    sections: Optional[dict] = None


class ProposalResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    lead_id: UUID
    created_by: Optional[UUID] = None
    proposal_type: str
    title: str
    status: str
    ai_tone: str
    content_markdown: Optional[str] = None
    content_html: Optional[str] = None
    sections: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    # Enriched from leads table
    lead_company: Optional[str] = None
    lead_contact: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
