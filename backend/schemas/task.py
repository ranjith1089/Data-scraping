"""Pydantic schemas for Tasks — Phase 9."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreateTaskRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    task_type: str = Field("follow_up", pattern=r"^(follow_up|call|email|meeting|other)$")
    priority: str = Field("medium", pattern=r"^(low|medium|high|urgent)$")
    due_date: Optional[datetime] = None
    lead_id: Optional[UUID] = None
    deal_id: Optional[UUID] = None
    assigned_to: Optional[UUID] = None


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    task_type: Optional[str] = Field(None, pattern=r"^(follow_up|call|email|meeting|other)$")
    priority: Optional[str] = Field(None, pattern=r"^(low|medium|high|urgent)$")
    status: Optional[str] = Field(None, pattern=r"^(pending|in_progress|done|cancelled)$")
    due_date: Optional[datetime] = None
    lead_id: Optional[UUID] = None
    deal_id: Optional[UUID] = None
    assigned_to: Optional[UUID] = None


class TaskResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    created_by: Optional[UUID] = None
    assigned_to: Optional[UUID] = None
    lead_id: Optional[UUID] = None
    deal_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    task_type: str
    priority: str
    status: str
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Enriched fields (populated by router)
    lead_company: Optional[str] = None
    lead_contact: Optional[str] = None
    deal_title: Optional[str] = None
    assigned_to_name: Optional[str] = None
    is_overdue: bool = False

    model_config = ConfigDict(from_attributes=True)


class TaskSummary(BaseModel):
    pending: int = 0
    in_progress: int = 0
    done: int = 0
    cancelled: int = 0
    overdue: int = 0
    due_today: int = 0
    due_this_week: int = 0
    total: int = 0
