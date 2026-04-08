from pydantic import BaseModel, Field
from typing import List


class DashboardOverview(BaseModel):
    total_leads: int = 0
    with_email: int = 0
    with_phone: int = 0
    hot_leads: int = 0
    leads_added_this_week: int = 0


class AIUsageStats(BaseModel):
    calls_this_month: int = 0
    tokens_used: int = 0
    calls_remaining: int = 0


class SectorStat(BaseModel):
    sector: str
    sector_name: str
    count: int = 0
    hot_count: int = 0
    avg_score: float = 0.0


class StageStat(BaseModel):
    stage: str
    count: int = 0
    total_value_inr: int = 0


class DistrictStat(BaseModel):
    district: str
    count: int = 0


class CampaignStat(BaseModel):
    name: str
    sent: int = 0
    opened: int = 0
    replied: int = 0
    open_rate: float = 0.0


class FunnelData(BaseModel):
    awareness: int = 0
    interest: int = 0
    consideration: int = 0
    intent: int = 0
    demo: int = 0
    proposal: int = 0
    won: int = 0


class DashboardResponse(BaseModel):
    overview: DashboardOverview
    ai_usage: AIUsageStats
    by_sector: List[SectorStat]
    by_stage: List[StageStat]
    by_district: List[DistrictStat]
    campaign_stats: List[CampaignStat]
    funnel: FunnelData
    activity_feed: List[dict] = Field(default_factory=list)
    ai_insights: str = ""
