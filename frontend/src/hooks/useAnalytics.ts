import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export interface DashboardData {
  total_leads: number
  leads_by_stage: Record<string, number>
  leads_by_sector: Record<string, number>
  conversion_rate: number
  average_score: number
  total_revenue_pipeline: number
  new_leads_today: number
  new_leads_this_week: number
  new_leads_this_month: number
  top_performing_sectors: {
    sector_code: string
    lead_count: number
    avg_score: number
    conversion_rate: number
  }[]
  recent_activities: {
    id: string
    type: string
    description: string
    lead_id: string
    lead_name: string
    timestamp: string
  }[]
  score_distribution: {
    range: string
    count: number
  }[]
  stage_funnel: {
    stage: string
    count: number
    value: number
  }[]
  monthly_trends: {
    month: string
    new_leads: number
    converted: number
    lost: number
  }[]
}

// The backend /analytics/dashboard returns a different, flatter shape than
// the frontend historically expected (see DashboardData). Rather than touch
// every consuming component, we normalize the payload here in one place.
// Backend shape (see backend/services/analytics_service.py + curl output):
//   {
//     overview: { total_leads, hot_leads, leads_added_this_week, with_email, with_phone },
//     ai_usage: { calls_this_month, tokens_used, calls_remaining },
//     by_sector: [{ sector, sector_name, count, hot_count, avg_score }],
//     by_stage:  [{ stage, count, total_value_inr }],
//     by_district: [{ district, count }],
//     campaign_stats: [...],
//     funnel: { awareness, interest, consideration, intent, demo, proposal, won },
//     activity_feed: [...],
//     ai_insights: string
//   }
interface RawDashboardResponse {
  overview?: {
    total_leads?: number
    hot_leads?: number
    leads_added_this_week?: number
    with_email?: number
    with_phone?: number
  }
  ai_usage?: {
    calls_this_month?: number
    tokens_used?: number
    calls_remaining?: number
  }
  by_sector?: Array<{
    sector: string
    sector_name?: string
    count: number
    hot_count?: number
    avg_score?: number
  }>
  by_stage?: Array<{
    stage: string
    count: number
    total_value_inr?: number
  }>
  campaign_stats?: unknown[]
  funnel?: Record<string, number>
  activity_feed?: Array<{
    id: string
    type: string
    description: string
    lead_id: string
    lead_name: string
    timestamp: string
  }>
  ai_insights?: string
}

function normalizeDashboard(raw: RawDashboardResponse | null | undefined): DashboardData {
  const overview = raw?.overview ?? {}
  const bySector = Array.isArray(raw?.by_sector) ? raw!.by_sector! : []
  const byStage = Array.isArray(raw?.by_stage) ? raw!.by_stage! : []
  const activityFeed = Array.isArray(raw?.activity_feed) ? raw!.activity_feed! : []

  const leads_by_stage: Record<string, number> = {}
  for (const row of byStage) {
    if (row && typeof row.stage === 'string') {
      leads_by_stage[row.stage] = row.count ?? 0
    }
  }

  const leads_by_sector: Record<string, number> = {}
  for (const row of bySector) {
    if (row && typeof row.sector === 'string') {
      leads_by_sector[row.sector] = row.count ?? 0
    }
  }

  const top_performing_sectors = bySector.map((s) => ({
    sector_code: s.sector,
    lead_count: s.count ?? 0,
    avg_score: s.avg_score ?? 0,
    // Derive a conversion-like rate from hot_count/count since the backend
    // does not ship a real conversion_rate per sector yet.
    conversion_rate:
      s.count && s.count > 0 ? ((s.hot_count ?? 0) / s.count) * 100 : 0,
  }))

  return {
    total_leads: overview.total_leads ?? 0,
    leads_by_stage,
    leads_by_sector,
    conversion_rate: 0,
    average_score: 0,
    total_revenue_pipeline: 0,
    new_leads_today: 0,
    new_leads_this_week: overview.leads_added_this_week ?? 0,
    new_leads_this_month: 0,
    top_performing_sectors,
    recent_activities: activityFeed,
    score_distribution: [],
    stage_funnel: byStage.map((s) => ({
      stage: s.stage,
      count: s.count ?? 0,
      value: s.total_value_inr ?? 0,
    })),
    monthly_trends: [],
  }
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get<RawDashboardResponse>('/analytics/dashboard')
      return normalizeDashboard(data)
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

export interface AIInsights {
  summary: string
  key_insights: {
    title: string
    description: string
    impact: 'high' | 'medium' | 'low'
    category: 'opportunity' | 'risk' | 'trend' | 'action'
  }[]
  recommended_actions: {
    action: string
    priority: 'high' | 'medium' | 'low'
    estimated_impact: string
    target_leads: number
  }[]
  sector_predictions: {
    sector_code: string
    sector_name: string
    growth_prediction: 'up' | 'stable' | 'down'
    confidence: number
    reasoning: string
  }[]
  hot_leads: {
    lead_id: string
    company_name: string
    score: number
    reason: string
  }[]
  at_risk_leads: {
    lead_id: string
    company_name: string
    risk_reason: string
    suggested_action: string
  }[]
  generated_at: string
}

export function useAIInsights() {
  return useQuery({
    queryKey: ['ai-insights'],
    queryFn: async () => {
      const { data } = await api.get<AIInsights>('/analytics/ai-insights')
      return data
    },
    staleTime: 5 * 60_000,
  })
}

export interface SectorAnalytics {
  sector_code: string
  sector_name: string
  total_leads: number
  active_leads: number
  won_leads: number
  lost_leads: number
  average_score: number
  total_pipeline_value: number
  conversion_rate: number
  avg_deal_cycle_days: number
  top_cities: { city: string; count: number }[]
  stage_distribution: Record<string, number>
  monthly_trend: { month: string; count: number }[]
}

export function useSectorAnalytics(sectorCode?: string) {
  return useQuery({
    queryKey: ['sector-analytics', sectorCode],
    queryFn: async () => {
      const url = sectorCode
        ? `/analytics/sectors/${sectorCode}`
        : '/analytics/sectors'
      const { data } = await api.get<SectorAnalytics | SectorAnalytics[]>(url)
      return data
    },
    staleTime: 60_000,
  })
}

export interface PipelineData {
  stages: {
    stage: string
    leads: {
      id: string
      company_name: string
      contact_name: string
      ai_score: number
      sector_code: string
      deal_value: number
      days_in_stage: number
      last_activity: string
    }[]
    total_value: number
    count: number
  }[]
  total_pipeline_value: number
  weighted_pipeline_value: number
  average_deal_size: number
  average_cycle_time: number
}

export function usePipeline() {
  return useQuery({
    queryKey: ['pipeline'],
    queryFn: async () => {
      const { data } = await api.get<PipelineData>('/analytics/pipeline')
      return data
    },
    staleTime: 30_000,
  })
}
