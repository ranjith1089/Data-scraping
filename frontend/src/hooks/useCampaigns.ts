import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

// Mirrors backend/schemas/campaign.py::CampaignResponse exactly. Historically
// this interface drifted (described {campaign_type, sector_code (singular),
// opened_count, replied_count, total_recipients, description, completed_at})
// which crashed CampaignDetailPage with "Cannot read properties of undefined"
// and produced NaN% stats on CampaignsPage. Don't add fields unless the
// backend response actually includes them.
export interface Campaign {
  id: string
  tenant_id: string
  name: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  sector_codes: string[]
  channel: 'email' | 'whatsapp' | 'sms' | 'linkedin' | 'multi'
  segment_filter: Record<string, unknown> | null
  daily_limit: number
  ai_tone: string
  total_leads: number
  sent_count: number
  open_count: number
  reply_count: number
  created_at: string
  updated_at?: string | null
  started_at?: string | null
}

// Mirrors backend/routers/campaigns.py::get_campaign_stats response shape.
// The old interface (opened_count / clicked_count / replied_count / bounced_count)
// didn't match the actual API, which returns {sent, opened, clicked, replied,
// failed} without the _count suffix — any read of stats.opened_count etc.
// yielded undefined, and the Performance tab rendered "NaN%" or crashed.
export interface CampaignStats {
  campaign_id: string
  campaign_name: string
  status: string
  total_outreach: number
  sent: number
  opened: number
  clicked: number
  replied: number
  failed: number
  open_rate: number
  click_rate: number
  reply_rate: number
  steps: Array<{
    step_id: string
    step_number: number
    channel: string
    sent: number
    opened: number
    replied: number
    open_rate: number
  }>
}

// The backend currently returns a plain JSON array from GET /campaigns/.
// The old `CampaignListResponse` envelope shape was aspirational (paginated
// response) but never shipped, and the hook used to type the response as
// that envelope — so `data?.items` was always undefined and the Campaigns
// page permanently showed "No campaigns yet" regardless of what was in the
// database. We now type the response as the raw array AND tolerate either
// shape at runtime so a future server-side pagination upgrade doesn't break
// the UI.
export interface CampaignListResponse {
  items: Campaign[]
  total?: number
  page?: number
  per_page?: number
  pages?: number
}

export function useCampaigns(params: {
  status?: string
  sector_code?: string
  page?: number
  per_page?: number
} = {}) {
  return useQuery<CampaignListResponse>({
    queryKey: ['campaigns', params],
    queryFn: async () => {
      const { data } = await api.get<Campaign[] | CampaignListResponse>(
        '/campaigns/',
        { params },
      )
      // Normalise: accept either a bare array (current backend shape) or a
      // paginated envelope {items, total, ...} (future backend shape).
      if (Array.isArray(data)) {
        return { items: data, total: data.length, page: 1, per_page: data.length, pages: 1 }
      }
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

export interface CampaignStepPayload {
  step_number: number
  channel: 'email' | 'whatsapp'
  delay_days: number
  subject?: string | null
  body?: string | null
  ai_generated?: boolean
  // A/B testing (GAP 2)
  variant_b_subject?: string | null
  variant_b_body?: string | null
  ab_split_pct?: number
}

export interface VariantStats {
  sent: number
  opened: number
  clicked: number
  replied: number
  open_rate: number
  click_rate: number
}

export interface CampaignStepABResults {
  step_id: string
  has_variant_b: boolean
  variant_a: VariantStats
  variant_b: VariantStats
  winner: 'a' | 'b' | null
  lift_pct: number | null
  sample_threshold: number
}

export function useCampaignStepABResults(
  campaignId: string,
  stepId: string | null,
) {
  return useQuery({
    queryKey: ['campaign-step-ab-results', campaignId, stepId],
    queryFn: async () => {
      const { data } = await api.get<CampaignStepABResults>(
        `/campaigns/${campaignId}/steps/${stepId}/ab-results`,
      )
      return data
    },
    enabled: !!campaignId && !!stepId,
  })
}

export function useBulkUpsertCampaignSteps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { campaignId: string; steps: CampaignStepPayload[] }) => {
      const { data } = await api.post(
        `/campaigns/${vars.campaignId}/steps`,
        vars.steps,
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['campaign', variables.campaignId] })
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
