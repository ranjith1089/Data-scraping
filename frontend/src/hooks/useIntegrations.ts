import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ---------------------------------------------------------------------------
// Shared types (mirror backend/schemas/integration.py)
// ---------------------------------------------------------------------------

export type IntegrationStatus =
  | 'disconnected'
  | 'connected'
  | 'error'
  | 'expired'

export type IntegrationProviderCode =
  | 'meta_ads'
  | 'google_ads'
  | 'linkedin_ads'
  | 'whatsapp'
  | 'whatsapp_gupshup'
  | 'sendgrid'
  | 'smtp'
  | 'ga4'
  | 'fb_pixel'

export interface Integration {
  id: string
  tenant_id: string
  provider: IntegrationProviderCode
  display_name: string
  status: IntegrationStatus
  config: Record<string, unknown>
  has_credentials: boolean
  credential_preview: Record<string, string> | null
  last_sync_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface IntegrationCreatePayload {
  provider: IntegrationProviderCode
  display_name?: string | null
  config?: Record<string, unknown> | null
  credentials?: Record<string, string> | null
}

export interface IntegrationUpdatePayload {
  display_name?: string | null
  config?: Record<string, unknown> | null
  credentials?: Record<string, string> | null
  status?: IntegrationStatus | null
}

export interface IntegrationTestResult {
  ok: boolean
  provider: string
  message: string
  details?: Record<string, unknown> | null
}

export interface IntegrationEvent {
  id: number
  tenant_id: string
  integration_id: string | null
  direction: 'inbound' | 'outbound'
  event_type: string
  status: string
  error: string | null
  payload: Record<string, unknown> | null
  lead_id: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data } = await api.get<Integration[]>('/integrations/')
      return data
    },
  })
}

export function useIntegration(id: string | undefined) {
  return useQuery({
    queryKey: ['integration', id],
    queryFn: async () => {
      const { data } = await api.get<Integration>(`/integrations/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useIntegrationEvents(id: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['integration-events', id, limit],
    queryFn: async () => {
      const { data } = await api.get<IntegrationEvent[]>(
        `/integrations/${id}/events`,
        { params: { limit } },
      )
      return data
    },
    enabled: !!id,
  })
}

export function useIntegrationProviders() {
  return useQuery({
    queryKey: ['integration-providers'],
    queryFn: async () => {
      const { data } = await api.get<string[]>('/integrations/providers')
      return data
    },
    staleTime: 60 * 60 * 1000, // 1 hour — provider list is effectively static
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: IntegrationCreatePayload) => {
      const { data } = await api.post<Integration>('/integrations/', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] })
    },
  })
}

export function useUpdateIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: IntegrationUpdatePayload & { id: string }) => {
      const { data } = await api.patch<Integration>(
        `/integrations/${id}`,
        payload,
      )
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['integrations'] })
      qc.invalidateQueries({ queryKey: ['integration', variables.id] })
    },
  })
}

export function useDeleteIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/integrations/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] })
    },
  })
}

export function useTestIntegration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<IntegrationTestResult>(
        `/integrations/${id}/test`,
      )
      return data
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['integrations'] })
      qc.invalidateQueries({ queryKey: ['integration', id] })
    },
  })
}
