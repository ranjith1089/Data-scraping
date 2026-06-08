import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeadReport {
  growth: { date: string; count: number }[]
  by_sector: { sector: string; count: number }[]
  by_stage: { stage: string; count: number }[]
  by_score: { bucket: string; count: number }[]
  by_icp: { icp_fit: string; count: number }[]
  totals: {
    total: number
    with_email: number
    with_phone: number
    enriched: number
    hot: number
  }
  days: number
}

export interface RevenueReport {
  monthly_won: { month: string; revenue: number; count: number }[]
  win_loss_trend: { month: string; won: number; lost: number }[]
  pipeline_by_stage: {
    stage_name: string
    deal_count: number
    total_value: number
    weighted_value: number
  }[]
  status_counts: { open: number; won: number; lost: number; on_hold: number }
  avg_deal_size: number
  top_deals: {
    id: string
    title: string
    value_inr: number
    stage_name: string | null
    probability: number | null
    close_date: string | null
  }[]
  months: number
}

export interface OutreachReport {
  email_campaigns: {
    name: string
    sent: number
    opened: number
    replied: number
    open_rate: number
    reply_rate: number
  }[]
  whatsapp: {
    total: number
    sent: number
    delivered: number
    read: number
    received: number
    failed: number
    pending: number
    reply_rate: number
  }
  linkedin: {
    total: number
    pending: number
    sent: number
    connected: number
    replied: number
    connection_rate: number
    reply_rate: number
  }
  email_sequences: {
    total_sequences: number
    active_enrollments: number
    completed: number
    paused: number
    total_enrollments: number
    emails_sent: number
    replied: number
    completion_rate: number
    reply_rate: number
  }
  channel_summary: { channel: string; sent: number; replied: number }[]
}

export interface ActivitiesReport {
  weekly: {
    week: string
    call: number
    email: number
    meeting: number
    note: number
    total: number
  }[]
  by_type: { type: string; count: number }[]
  recent: { id: string; type: string; note: string; created_at: string }[]
  weeks: number
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useLeadReport(days: 30 | 60 | 90 = 90) {
  return useQuery<LeadReport>({
    queryKey: ['reports', 'leads', days],
    queryFn: async () => {
      const { data } = await api.get<LeadReport>('/reports/leads', { params: { days } })
      return data
    },
    staleTime: 5 * 60_000,
  })
}

export function useRevenueReport(months: 6 | 12 = 12) {
  return useQuery<RevenueReport>({
    queryKey: ['reports', 'revenue', months],
    queryFn: async () => {
      const { data } = await api.get<RevenueReport>('/reports/revenue', { params: { months } })
      return data
    },
    staleTime: 5 * 60_000,
  })
}

export function useOutreachReport() {
  return useQuery<OutreachReport>({
    queryKey: ['reports', 'outreach'],
    queryFn: async () => {
      const { data } = await api.get<OutreachReport>('/reports/outreach')
      return data
    },
    staleTime: 5 * 60_000,
  })
}

export function useActivitiesReport(weeks: 4 | 8 | 12 = 8) {
  return useQuery<ActivitiesReport>({
    queryKey: ['reports', 'activities', weeks],
    queryFn: async () => {
      const { data } = await api.get<ActivitiesReport>('/reports/activities', { params: { weeks } })
      return data
    },
    staleTime: 5 * 60_000,
  })
}
