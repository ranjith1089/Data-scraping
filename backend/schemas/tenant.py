from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from typing import Optional, List
from datetime import datetime
from enum import Enum


class PlanType(str, Enum):
    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class TenantStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"


class TenantCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-z0-9-]+$")
    plan: PlanType = Field(default=PlanType.FREE)


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    plan: Optional[PlanType] = None
    settings: Optional[dict] = None
    is_active: Optional[bool] = None


class TenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    plan: str
    settings: Optional[dict] = None
    is_active: bool
    status: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Super-admin (platform) schemas
# ---------------------------------------------------------------------------


class AdminTenantOwnerCreate(BaseModel):
    """Optional nested owner to create alongside a new tenant."""

    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    full_name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)


class AdminTenantCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-z0-9-]+$")
    plan: PlanType = Field(default=PlanType.STARTER)
    settings: Optional[dict] = None
    owner: Optional[AdminTenantOwnerCreate] = None


class AdminTenantUpdate(BaseModel):
    """Partial update. ``status`` is intentionally NOT mutable here — use
    the dedicated suspend/reactivate/cancel action endpoints instead."""

    name: Optional[str] = Field(None, min_length=2, max_length=100)
    plan: Optional[PlanType] = None
    settings: Optional[dict] = None
    owner_id: Optional[UUID] = None


class AdminTenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    plan: str
    status: str
    is_active: bool
    settings: Optional[dict] = None
    owner_id: Optional[UUID] = None
    suspended_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Aggregated stats (populated by the list/detail endpoints)
    user_count: Optional[int] = None
    lead_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class AdminTenantListResponse(BaseModel):
    items: List[AdminTenantResponse]
    total: int
    limit: int
    offset: int


class AdminTenantStatsResponse(BaseModel):
    tenant_id: UUID
    user_count: int
    active_user_count: int
    lead_count: int
    campaign_count: int
    integration_count: int
    last_activity_at: Optional[datetime] = None


class AdminUserInTenantCreate(BaseModel):
    """Create a user inside a target tenant (super-admin flow)."""

    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    full_name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default="member", max_length=32)


class AdminUserResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    is_superuser: bool = False
    last_login: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
