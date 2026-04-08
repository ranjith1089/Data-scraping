import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

export interface Campaign {
  id: string
  tenant_id: string
  name: string
  description: string
  sector_code: string
  campaign_type: 'email' | 'whatsapp' | 'sms' | 'multi_channel'
  status: 'draft' | 'active' | 'paused' | 'completed'
  target_filters: Record<string, unknown>
  template_id: string | null
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  total_recipients: number
  sent_count: number
  opened_count: number
  clicked_count: number
  replied_count: number
  bounced_count: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface CampaignStats {
  total_recipients: number
  sent_count: number
  opened_count: number
  clicked_count: number
  replied_count: number
  bounced_count: number
  open_rate: number
  click_rate: number
  reply_rate: number
  bounce_rate: number
}

export interface CampaignListResponse {
  items: Campaign[]
  total: number
  page: number
  per_page: number
  pages: number
}

export function useCampaigns(params: {
  status?: string
  sector_code?: string
  page?: number
  per_page?: number
} = {}) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: async () => {
      const { data } = await api.get<CampaignListResponse>('/campaigns/', {
        params,
      })
      return data
    },
  })
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const { data } = await api.get<Campaign>(`/campaigns/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCampaignStats(id: string) {
  return useQuery({
    queryKey: ['campaign-stats', id],
    queryFn: async () => {
      const { data } = await api.get<CampaignStats>(
        `/campaigns/${id}/stats`
      )
      return data
    },
    enabled: !!id,
    refetchInterval: 30_000,
  })
}

export function useCreateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (campaign: Partial<Campaign>) => {
      const { data } = await api.post<Campaign>('/campaigns/', campaign)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
}

export function useUpdateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Campaign> & { id: string }) => {
      const { data } = await api.patch<Campaign>(`/campaigns/${id}`, updates)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      qc.invalidateQueries({ queryKey: ['campaign', variables.id] })
    },
  })
}

export function useStartCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/campaigns/${id}/start`)
      return data
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      qc.invalidateQueries({ queryKey: ['campaign', id] })
    },
  })
}

export function usePauseCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/campaigns/${id}/pause`)
      return data
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      qc.invalidateQueries({ queryKey: ['campaign', id] })
    },
  })
}

export function useDeleteCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/campaigns/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
}
