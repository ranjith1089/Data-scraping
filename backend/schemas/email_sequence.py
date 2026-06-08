"""Pydantic schemas for Phase 6 — Email Sequences."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


# ─── Step schemas ─────────────────────────────────────────────────────────────

class CreateSequenceStepRequest(BaseModel):
    step_order: int
    delay_days: int = 0
    subject: str
    body: str
    email_type: str = "follow_up"
    ai_tone: str = "professional"


class UpdateSequenceStepRequest(BaseModel):
    step_order: Optional[int] = None
    delay_days: Optional[int] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    email_type: Optional[str] = None
    ai_tone: Optional[str] = None


class SequenceStepResponse(BaseModel):
    id: UUID
    sequence_id: UUID
    tenant_id: UUID
    step_order: int
    delay_days: int
    subject: str
    body: str
    email_type: str
    ai_tone: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Sequence schemas ─────────────────────────────────────────────────────────

class CreateSequenceRequest(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateSequenceRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in ("draft", "active", "paused", "archived"):
            raise ValueError("Invalid status")
        return v


class SequenceResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str] = None
    status: str
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    # Computed fields populated by the router
    step_count: int = 0
    enrolled_count: int = 0
    active_count: int = 0
    completed_count: int = 0
    reply_count: int = 0

    class Config:
        from_attributes = True


class SequenceDetailResponse(SequenceResponse):
    steps: List[SequenceStepResponse] = []


# ─── Enrollment schemas ───────────────────────────────────────────────────────

class EnrollLeadRequest(BaseModel):
    lead_id: UUID


class BulkEnrollRequest(BaseModel):
    lead_ids: List[UUID]


class EnrollmentResponse(BaseModel):
    id: UUID
    sequence_id: UUID
    lead_id: UUID
    tenant_id: UUID
    enrolled_by: Optional[UUID] = None
    status: str
    current_step: int
    next_step_at: Optional[datetime] = None
    enrolled_at: datetime
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Enriched
    lead_company: Optional[str] = None
    lead_contact: Optional[str] = None
    lead_email: Optional[str] = None
    sequence_name: Optional[str] = None

    class Config:
        from_attributes = True


class UpdateEnrollmentRequest(BaseModel):
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: Optional[str]) -> Optional[str]:
        allowed = ("active", "paused", "completed", "unsubscribed")
        if v and v not in allowed:
            raise ValueError(f"status must be one of {allowed}")
        return v


# ─── Log / stats schemas ─────────────────────────────────────────────────────

class SequenceEmailLogResponse(BaseModel):
    id: UUID
    enrollment_id: UUID
    step_id: Optional[UUID] = None
    lead_id: UUID
    step_order: Optional[int] = None
    subject: Optional[str] = None
    status: str
    sendgrid_message_id: Optional[str] = None
    sent_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    replied_at: Optional[datetime] = None
    error_msg: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class StepStat(BaseModel):
    step_order: int
    subject: str
    sent: int
    opened: int
    replied: int
    open_rate: float
    reply_rate: float


class SequenceStatsResponse(BaseModel):
    sequence_id: UUID
    total_enrolled: int
    active: int
    completed: int
    unsubscribed: int
    total_sent: int
    total_opened: int
    total_replied: int
    overall_open_rate: float
    overall_reply_rate: float
    per_step: List[StepStat] = []
