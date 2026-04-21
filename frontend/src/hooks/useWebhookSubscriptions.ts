import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export type WebhookEventType =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.stage_changed'

export interface WebhookSubscription {
  id: string
  url: string
  event_types: WebhookEventType[]
  is_active: boolean
  last_delivery_at: string | null
  last_error: string | null
  failure_count: number
  has_secret: boolean
  secret_preview: string | null
  created_at: string
}

export interface WebhookSubscriptionCreated extends WebhookSubscription {
  secret: string // plaintext, shown once
}

export interface WebhookCreatePayload {
  url: string
  event_types: WebhookEventType[]
}

export interface WebhookTestResult {
  ok: boolean
  status_code: number | null
  response_body: string | null
  error: string | null
}

export function useWebhookSubscriptions() {
  return useQuery({
    queryKey: ['webhook-subscriptions'],
    queryFn: async () => {
      const { data } = await api.get<WebhookSubscription[]>(
        '/webhooks/subscriptions/',
      )
      return data
    },
  })
}

export function useCreateWebhookSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: WebhookCreatePayload) => {
      const { data } = await api.post<WebhookSubscriptionCreated>(
        '/webhooks/subscriptions/',
        payload,
      )
      return data
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['webhook-subscriptions'] }),
  })
}

export function useDeleteWebhookSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/webhooks/subscriptions/${id}`)
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['webhook-subscriptions'] }),
  })
}

export function useTestWebhookSubscription() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<WebhookTestResult>(
        `/webhooks/subscriptions/${id}/test`,
      )
      return data
    },
  })
}
