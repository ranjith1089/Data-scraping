"""Pydantic schemas for Lead Discovery (Phase 3 — Apollo.io search)."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Search request
# ---------------------------------------------------------------------------


class DiscoverRequest(BaseModel):
    """Search Apollo.io for potential leads matching the given criteria."""

    sector_code: str = "college"
    # Job titles to target. If empty, the service uses sector defaults.
    target_roles: List[str] = Field(default_factory=list)
    # Indian state name (e.g. "Tamil Nadu", "Karnataka"). None → all India.
    location_state: Optional[str] = None
    # City within the state (e.g. "Chennai"). Used together with state.
    location_city: Optional[str] = None
    # Our CompanySize enum strings: "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"
    company_size: Optional[str] = None
    # Extra free-text keywords (e.g. "React", "AWS")
    keywords: List[str] = Field(default_factory=list)
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=25, ge=1, le=50)


# ---------------------------------------------------------------------------
# A single discovered (pre-import) lead
# ---------------------------------------------------------------------------


class DiscoveredLead(BaseModel):
    """A candidate lead returned from Apollo — not yet in the CRM."""

    # Apollo's internal person ID — used to detect dupes at import time
    apollo_id: Optional[str] = None
    company_name: str
    contact_name: str
    designation: Optional[str] = None
    email: Optional[str] = None          # may be masked ("r****@company.com")
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    website: Optional[str] = None
    company_size: Optional[str] = None
    industry: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    # Whether this lead already exists in the tenant's CRM (matched by email)
    already_exists: bool = False
    existing_lead_id: Optional[UUID] = None


class DiscoverResponse(BaseModel):
    leads: List[DiscoveredLead]
    total: int
    page: int
    per_page: int
    total_pages: int
    # Warns if the API key is missing or the plan doesn't allow more results
    warning: Optional[str] = None


# ---------------------------------------------------------------------------
# Import request / response
# ---------------------------------------------------------------------------


class ImportLeadsRequest(BaseModel):
    """Import a subset of discovered leads into the CRM."""

    sector_code: str
    leads: List[DiscoveredLead]
    # Skip leads whose email already exists in the tenant's CRM
    skip_duplicates: bool = True


class ImportLeadsResult(BaseModel):
    imported: int
    skipped_duplicates: int
    imported_ids: List[UUID]
