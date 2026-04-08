from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from typing import Optional
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


class DealResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    lead_id: UUID
    stage_id: UUID
    title: str
    value_inr: Optional[float] = None
    close_date: Optional[date] = None
    probability: Optional[int] = None
    notes: Optional[str] = None
    assigned_to: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
