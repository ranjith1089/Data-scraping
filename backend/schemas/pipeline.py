from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from typing import List, Optional
from datetime import date, datetime


class PipelineStageCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    order_index: int = Field(..., ge=0)
    color: Optional[str] = Field(
        None, max_length=7, pattern=r"^#[0-9a-fA-F]{6}$",
        description="Hex color code, e.g. #FF5733",
    )
    is_default: bool = Field(default=False)


class PipelineStageUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    order_index: Optional[int] = Field(None, ge=0)
    color: Optional[str] = Field(None, max_length=7, pattern=r"^#[0-9a-fA-F]{6}$")
    is_default: Optional[bool] = None


class PipelineStageResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    order_index: int
    color: Optional[str] = None
    is_default: bool
    deal_count: int = 0
    total_value_inr: float = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DealCreate(BaseModel):
    lead_id: UUID
    stage_id: UUID
    title: str = Field(..., min_length=1, max_length=200)
    value_inr: Optional[float] = Field(None, ge=0)
    close_date: Optional[date] = None
    probability: Optional[int] = Field(None, ge=0, le=100)
    notes: Optional[str] = Field(None, max_length=5000)
    assigned_to: Optional[UUID] = None


class DealUpdate(BaseModel):
    stage_id: Optional[UUID] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    value_inr: Optional[float] = Field(None, ge=0)
    close_date: Optional[date] = None
    probability: Optional[int] = Field(None, ge=0, le=100)
    notes: Optional[str] = Field(None, max_length=5000)
    assigned_to: Optional[UUID] = None
    status: Optional[str] = None


class DealResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    lead_id: Optional[UUID] = None
    stage_id: Optional[UUID] = None
    title: str
    value_inr: Optional[float] = None
    close_date: Optional[date] = None
    probability: Optional[int] = None
    notes: Optional[str] = None
    assigned_to: Optional[UUID] = None
    # Phase 7
    status: str = "open"
    lost_reason: Optional[str] = None
    won_at: Optional[datetime] = None
    lost_at: Optional[datetime] = None
    # Enriched (populated by router)
    lead_company: Optional[str] = None
    lead_contact: Optional[str] = None
    stage_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Won / Lost ───────────────────────────────────────────────────────────────

class MarkWonRequest(BaseModel):
    pass  # no body required


class MarkLostRequest(BaseModel):
    lost_reason: Optional[str] = Field(None, max_length=500)


# ─── Deal Activities ──────────────────────────────────────────────────────────

class DealActivityCreate(BaseModel):
    activity_type: str = Field("note", pattern=r"^(note|call|email|meeting)$")
    content: str = Field(..., min_length=1, max_length=2000)
    occurred_at: Optional[datetime] = None


class DealActivityResponse(BaseModel):
    id: UUID
    deal_id: UUID
    tenant_id: UUID
    created_by: Optional[UUID] = None
    activity_type: str
    content: str
    occurred_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Revenue forecast ─────────────────────────────────────────────────────────

class RevenueForecast(BaseModel):
    total_pipeline_inr: float       # all open deals
    weighted_pipeline_inr: float    # sum(value × probability/100)
    won_this_month_inr: float
    won_this_month_count: int
    open_count: int
    won_count: int
    lost_count: int
    win_rate: float                  # won / (won + lost) × 100
    avg_deal_size_inr: float
    deals_closing_this_month: int
    overdue_deals: int
