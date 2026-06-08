import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Deal {
  id: string
  tenant_id: string
  lead_id: string | null
  stage_id: string | null
  title: string
  value_inr: number | null
  close_date: string | null
  probability: number | null
  notes: string | null
  assigned_to: string | null
  status: 'open' | 'won' | 'lost' | 'on_hold'
  lost_reason: string | null
  won_at: string | null
  lost_at: string | null
  lead_company: string | null
  lead_contact: string | null
  stage_name: string | null
  created_at: string
  updated_at: string | null
}

export interface DealActivity {
  id: string
  deal_id: string
  tenant_id: string
  created_by: string | null
  activity_type: 'note' | 'call' | 'email' | 'meeting'
  content: string
  occurred_at: string
  created_at: string
}

export interface RevenueForecast {
  total_pipeline_inr: number
  weighted_pipeline_inr: number
  won_this_month_inr: number
  won_this_month_count: number
  open_count: number
  won_count: number
  lost_count: number
  win_rate: number
  avg_deal_size_inr: number
  deals_closing_this_month: number
  overdue_deals: number
}

export interface CreateDealRequest {
  lead_id: string
  stage_id: string
  title: string
  value_inr?: number
  close_date?: string
  probability?: number
  notes?: string
  assigned_to?: string
}

export interface UpdateDealRequest {
  stage_id?: string
  title?: string
  value_inr?: number
  close_date?: string
  probability?: number
  notes?: string
  status?: string
}

export interface CreateActivityRequest {
  activity_type: 'note' | 'call' | 'email' | 'meeting'
  content: string
  occurred_at?: string
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const DEAL_KEYS = {
  all: ['deals'] as const,
  list: (filters?: Record<string, string>) =>
    ['deals', 'list', JSON.stringify(filters ?? {})] as const,
  detail: (id: string) => ['deals', id] as const,
  activities: (id: string) => ['deals', id, 'activities'] as const,
  leadDeals: (leadId: string) => ['deals', 'lead', leadId] as const,
  forecast: ['deals', 'forecast'] as const,
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useDeals(filters?: { stage_id?: string; status?: string }) {
  return useQuery<Deal[]>({
    queryKey: DEAL_KEYS.list(filters as Record<string, string>),
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (filters?.stage_id) params.stage_id = filters.stage_id
      const { data } = await api.get<Deal[]>('/pipeline/deals', { params })
      return data
    },
  })
}

export function useDeal(id: string) {
  return useQuery<Deal>({
    queryKey: DEAL_KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Deal>(`/pipeline/deals/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useLeadDeals(leadId: string) {
  return useQuery<Deal[]>({
    queryKey: DEAL_KEYS.leadDeals(leadId),
    queryFn: async () => {
      const { data } = await api.get<Deal[]>(`/pipeline/leads/${leadId}/deals`)
      return data
    },
    enabled: !!leadId,
  })
}

export function useRevenueForecast() {
  return useQuery<RevenueForecast>({
    queryKey: DEAL_KEYS.forecast,
    queryFn: async () => {
      const { data } = await api.get<RevenueForecast>('/pipeline/revenue')
      return data
    },
    staleTime: 60_000,
  })
}

export function useDealActivities(dealId: string) {
  return useQuery<DealActivity[]>({
    queryKey: DEAL_KEYS.activities(dealId),
    queryFn: async () => {
      const { data } = await api.get<DealActivity[]>(`/pipeline/deals/${dealId}/activities`)
      return data
    },
    enabled: !!dealId,
  })
}

export function useCreateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: CreateDealRequest) => {
      const { data } = await api.post<Deal>('/pipeline/deals', req)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DEAL_KEYS.all })
    },
  })
}

export function useUpdateDeal(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: UpdateDealRequest) => {
      const { data } = await api.patch<Deal>(`/pipeline/deals/${id}`, req)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DEAL_KEYS.detail(id) })
      qc.invalidateQueries({ queryKey: DEAL_KEYS.all })
    },
  })
}

export function useMarkWon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Deal>(`/pipeline/deals/${id}/won`, {})
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DEAL_KEYS.all })
      qc.invalidateQueries({ queryKey: ['deals', 'forecast'] })
    },
  })
}

export function useMarkLost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, lost_reason }: { id: string; lost_reason?: string }) => {
      const { data } = await api.post<Deal>(`/pipeline/deals/${id}/lost`, { lost_reason })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DEAL_KEYS.all })
      qc.invalidateQueries({ queryKey: ['deals', 'forecast'] })
    },
  })
}

export function useReopenDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Deal>(`/pipeline/deals/${id}/reopen`, {})
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: DEAL_KEYS.all }),
  })
}

export function useDeleteDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pipeline/deals/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: DEAL_KEYS.all }),
  })
}

export function useAddDealActivity(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: CreateActivityRequest) => {
      const { data } = await api.post<DealActivity>(
        `/pipeline/deals/${dealId}/activities`,
        req
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: DEAL_KEYS.activities(dealId) }),
  })
}

export function useDeleteDealActivity(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (activityId: string) => {
      await api.delete(`/pipeline/deals/${dealId}/activities/${activityId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: DEAL_KEYS.activities(dealId) }),
  })
}

// ─── Static data ─────────────────────────────────────────────────────────────

export const DEAL_STATUS_META: Record<string, { label: string; color: string }> = {
  open:    { label: 'Open',    color: 'bg-blue-50 text-blue-700' },
  won:     { label: 'Won',     color: 'bg-green-50 text-green-700' },
  lost:    { label: 'Lost',    color: 'bg-red-50 text-red-500' },
  on_hold: { label: 'On Hold', color: 'bg-amber-50 text-amber-700' },
}

export const ACTIVITY_TYPE_META: Record<string, { label: string; icon: string }> = {
  note:    { label: 'Note',    icon: '📝' },
  call:    { label: 'Call',    icon: '📞' },
  email:   { label: 'Email',   icon: '✉️' },
  meeting: { label: 'Meeting', icon: '🤝' },
}
