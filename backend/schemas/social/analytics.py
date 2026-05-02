"""Analytics response shapes for the Social Analytics page."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class SocialAnalyticsOverview(BaseModel):
    period_days: int
    dms_sent: int
    dms_delivered: int
    dms_failed: int
    leads_created: int
    conversion_rate: float
    avg_response_time_seconds: Optional[float] = None
    open_conversations: int


class RuleMetrics(BaseModel):
    rule_id: UUID
    rule_name: str
    fired_count: int
    leads_created: int
    success_rate: float


class CampaignMetrics(BaseModel):
    campaign_id: UUID
    campaign_name: str
    dms_sent: int
    leads_created: int
    conversion_rate: float


class FunnelStage(BaseModel):
    stage: str  # 'comments', 'dms_sent', 'dms_read', 'leads', 'won'
    count: int


class SocialAnalyticsByRule(BaseModel):
    rules: List[RuleMetrics]


class SocialAnalyticsByCampaign(BaseModel):
    campaigns: List[CampaignMetrics]


class SocialAnalyticsFunnel(BaseModel):
    stages: List[FunnelStage]
