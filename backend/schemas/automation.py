"""Pydantic schemas for automation rules and lead assignment rules."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TriggerType(str, Enum):
    LEAD_CREATED = "lead.created"
    LEAD_STAGE_CHANGED = "lead.stage_changed"
    LEAD_SCORED = "lead.scored"
    TIMER = "timer"


class AutomationRuleCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    trigger_type: TriggerType
    trigger_config: dict[str, Any] = Field(default_factory=dict)
    conditions: list[dict[str, Any]] = Field(default_factory=list)
    actions: list[dict[str, Any]] = Field(default_factory=list)
    enabled: bool = True


class AutomationRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    trigger_type: Optional[TriggerType] = None
    trigger_config: Optional[dict[str, Any]] = None
    conditions: Optional[list[dict[str, Any]]] = None
    actions: Optional[list[dict[str, Any]]] = None
    enabled: Optional[bool] = None


class AutomationRuleResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    trigger_type: str
    trigger_config: Optional[dict[str, Any]] = None
    conditions: Optional[list[dict[str, Any]]] = None
    actions: Optional[list[dict[str, Any]]] = None
    enabled: bool
    run_count: int
    last_run_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssignmentStrategy(str, Enum):
    ROUND_ROBIN = "round_robin"
    LOAD_BALANCED = "load_balanced"
    RULE_BASED = "rule_based"


class LeadAssignmentRuleCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    strategy: AssignmentStrategy = AssignmentStrategy.ROUND_ROBIN
    rules: list[dict[str, Any]] = Field(default_factory=list)
    user_pool: list[UUID] = Field(default_factory=list)
    enabled: bool = True


class LeadAssignmentRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    strategy: Optional[AssignmentStrategy] = None
    rules: Optional[list[dict[str, Any]]] = None
    user_pool: Optional[list[UUID]] = None
    enabled: Optional[bool] = None


class LeadAssignmentRuleResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    strategy: str
    rules: Optional[list[dict[str, Any]]] = None
    user_pool: Optional[list[UUID]] = None
    enabled: bool
    cursor: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
