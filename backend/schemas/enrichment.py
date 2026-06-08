"""Pydantic schemas for Lead Enrichment (Phase 2)."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EnrichRequest(BaseModel):
    """Enrich a single lead. Pass overwrite=true to update fields that already have data."""
    overwrite: bool = False


class BulkEnrichRequest(BaseModel):
    """Enrich multiple leads in one call (max 50)."""
    lead_ids: List[UUID]
    overwrite: bool = False


class EnrichmentResult(BaseModel):
    """What was found and what was updated for one lead."""
    lead_id: UUID
    status: str  # success | partial | failed | no_api_key | not_found
    source: str  # apollo | hunter | apollo+hunter | none
    fields_found: dict  # every field the API returned
    fields_updated: List[str]  # fields actually written to the lead row
    skipped_fields: List[str]  # fields found but not written (already had data)
    message: str  # human-readable summary


class BulkEnrichResult(BaseModel):
    results: List[EnrichmentResult]
    total: int
    enriched: int  # leads with at least one field updated
    not_found: int
    failed: int


class EnrichmentLogResponse(BaseModel):
    id: UUID
    lead_id: UUID
    source: str
    fields_found: Optional[dict] = None
    fields_updated: Optional[List[str]] = None
    status: str
    error: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
