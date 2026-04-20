from pydantic import BaseModel, ConfigDict, Field, field_validator
from uuid import UUID
from typing import Optional, List
from datetime import datetime
from enum import Enum


class LeadStage(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"
    NURTURE = "nurture"


class CompanySize(str, Enum):
    MICRO = "1-10"
    SMALL = "11-50"
    MEDIUM = "51-200"
    LARGE = "201-500"
    ENTERPRISE = "501-1000"
    CORPORATE = "1000+"


class LeadSource(str, Enum):
    MANUAL = "manual"
    IMPORT = "import"
    WEBSITE = "website"
    REFERRAL = "referral"
    LINKEDIN = "linkedin"
    CAMPAIGN = "campaign"
    API = "api"
    OTHER = "other"


class LeadCreate(BaseModel):
    sector_code: str = Field(..., min_length=2, max_length=20)
    company_name: str = Field(..., min_length=1, max_length=200)
    industry: Optional[str] = Field(None, max_length=100)
    sub_industry: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=50)
    district: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    pincode: Optional[str] = Field(None, max_length=10, pattern=r"^\d{4,10}$")
    website: Optional[str] = Field(None, max_length=500)
    company_size: Optional[CompanySize] = None
    annual_revenue_inr: Optional[float] = Field(None, ge=0)
    contact_name: Optional[str] = Field(None, max_length=100)
    designation: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone: Optional[str] = Field(None, max_length=20, pattern=r"^\+?[\d\s-]{7,20}$")
    linkedin_url: Optional[str] = Field(None, max_length=500)
    tags: List[str] = Field(default_factory=list)
    source: LeadSource = Field(default=LeadSource.MANUAL)
    custom_fields: Optional[dict] = None


class LeadUpdate(BaseModel):
    sector_code: Optional[str] = Field(None, min_length=2, max_length=20)
    company_name: Optional[str] = Field(None, min_length=1, max_length=200)
    industry: Optional[str] = Field(None, max_length=100)
    sub_industry: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=50)
    district: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    pincode: Optional[str] = Field(None, max_length=10, pattern=r"^\d{4,10}$")
    website: Optional[str] = Field(None, max_length=500)
    company_size: Optional[CompanySize] = None
    annual_revenue_inr: Optional[float] = Field(None, ge=0)
    contact_name: Optional[str] = Field(None, max_length=100)
    designation: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone: Optional[str] = Field(None, max_length=20, pattern=r"^\+?[\d\s-]{7,20}$")
    linkedin_url: Optional[str] = Field(None, max_length=500)
    tags: Optional[List[str]] = None
    source: Optional[LeadSource] = None
    custom_fields: Optional[dict] = None
    stage: Optional[LeadStage] = None
    assigned_to: Optional[UUID] = None


class LeadResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    sector_code: str
    company_name: str
    industry: Optional[str] = None
    sub_industry: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    pincode: Optional[str] = None
    website: Optional[str] = None
    company_size: Optional[str] = None
    annual_revenue_inr: Optional[float] = None
    contact_name: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    source: Optional[str] = None
    custom_fields: Optional[dict] = None

    # AI-generated fields
    lead_score: Optional[int] = None
    score_reason: Optional[str] = None
    icp_match: Optional[str] = None
    ai_summary: Optional[str] = None

    stage: str = "new"
    assigned_to: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    # The `leads.tags` column is nullable in Postgres (ARRAY(String),
    # nullable=True) so CSV-imported rows that didn't carry tags come
    # back from the ORM as `tags=None`. Without this coercion Pydantic
    # v2 rejects None against `List[str]` with a ValidationError, which
    # FastAPI then wraps as a ResponseValidationError and returns as a
    # 500 — turning GET /leads/ into a full failure even though every
    # row is otherwise valid. This is exactly how the TNEA import
    # broke the Leads page.
    @field_validator("tags", mode="before")
    @classmethod
    def _tags_none_to_empty(cls, v):
        return [] if v is None else v


class LeadListResponse(BaseModel):
    items: List[LeadResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class LeadSearchParams(BaseModel):
    sector_code: Optional[str] = None
    stage: Optional[LeadStage] = None
    min_score: Optional[int] = Field(None, ge=0, le=100)
    max_score: Optional[int] = Field(None, ge=0, le=100)
    district: Optional[str] = None
    city: Optional[str] = None
    company_size: Optional[CompanySize] = None
    assigned_to: Optional[UUID] = None
    search: Optional[str] = Field(None, max_length=200, description="Full-text search query")
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=200)
