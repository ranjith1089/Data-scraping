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

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get<DashboardData>('/analytics/dashboard')
      return data
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
