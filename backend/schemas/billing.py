"""Billing-visibility schemas (GAP 6)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class PlanDetail(BaseModel):
    code: str
    name: str
    price_inr: int
    features: dict = Field(default_factory=dict)


class PlanLimits(BaseModel):
    users: int
    leads: int
    ai_calls_per_month: int


class PlanUsage(BaseModel):
    users: int
    leads: int
    ai_calls_this_month: int
    ai_tokens_this_month: int


class UsagePercent(BaseModel):
    users: float
    leads: float
    ai_calls: float


class BillingCurrentResponse(BaseModel):
    plan: PlanDetail
    limits: PlanLimits
    usage: PlanUsage
    percent_used: UsagePercent
    next_reset_at: Optional[datetime] = None


class UpgradeRequest(BaseModel):
    target_plan: Literal["starter", "growth", "enterprise"]


class UpgradeResponse(BaseModel):
    ok: bool
    message: str
