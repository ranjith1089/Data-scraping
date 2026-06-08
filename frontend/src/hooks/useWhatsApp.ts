import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhatsAppMessage {
  id: string
  tenant_id: string
  lead_id: string
  created_by: string | null
  direction: 'outbound' | 'inbound'
  message_type: 'ai_generated' | 'manual' | 'template' | 'inbound'
  content: string
  template_name: string | null
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received'
  wa_message_id: string | null
  error_message: string | null
  phone_number: string | null
  ai_tone: string | null
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  created_at: string
  updated_at: string
  // Enriched
  lead_company: string | null
  lead_contact: string | null
  lead_phone: string | null
}

export interface GenerateWhatsAppRequest {
  tone: 'friendly' | 'professional' | 'value-first' | 'curiosity'
  context?: string
}

export interface SendWhatsAppRequest {
  content: string
  message_type?: string
  template_name?: string
  ai_tone?: string
}

export interface SendWhatsAppResult {
  success: boolean
  message_id: string | null
  wa_message_id: string | null
  status: string
  warning: string | null
}

// ─── Query keys ───────────────────────────────────────────────────────────────

const KEYS = {
  all: ['whatsapp'] as const,
  thread: (leadId: string) => ['whatsapp', 'thread', leadId] as const,
  list: (status?: string) => ['whatsapp', 'list', status ?? 'all'] as const,
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Conversation thread for a specific lead (ordered oldest→newest) */
export function useWhatsAppThread(leadId: string) {
  return useQuery<WhatsAppMessage[]>({
    queryKey: KEYS.thread(leadId),
    queryFn: async () => {
      const { data } = await api.get<WhatsAppMessage[]>(
        `/whatsapp/leads/${leadId}/messages`
      )
      return data
    },
    enabled: !!leadId,
    refetchInterval: 30_000, // poll every 30s for inbound replies
  })
}

/** Global message list for the WhatsApp outreach page */
export function useAllWhatsAppMessages(status?: string) {
  return useQuery<WhatsAppMessage[]>({
    queryKey: KEYS.list(status),
    queryFn: async () => {
      const params: Record<string, string> = { limit: '100' }
      if (status) params.status = status
      const { data } = await api.get<WhatsAppMessage[]>('/whatsapp/messages', { params })
      return data
    },
    refetchInterval: 30_000,
  })
}

/** AI-generate a WhatsApp opener for a lead */
export function useGenerateWhatsAppMessage(leadId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: GenerateWhatsAppRequest) => {
      const { data } = await api.post<WhatsAppMessage>(
        `/whatsapp/leads/${leadId}/generate`,
        req
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.thread(leadId) })
      qc.invalidateQueries({ queryKey: KEYS.list() })
    },
  })
}

/** Send a WhatsApp message to a lead */
export function useSendWhatsAppMessage(leadId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: SendWhatsAppRequest) => {
      const { data } = await api.post<SendWhatsAppResult>(
        `/whatsapp/leads/${leadId}/send`,
        req
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.thread(leadId) })
      qc.invalidateQueries({ queryKey: KEYS.list() })
    },
  })
}

/** Delete a message */
export function useDeleteWhatsAppMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/whatsapp/messages/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

// ─── Static data ─────────────────────────────────────────────────────────────

export const WA_STATUSES: {
  value: WhatsAppMessage['status']
  label: string
  color: string
  outbound: boolean
}[] = [
  { value: 'pending',   label: 'Pending',   color: 'bg-gray-100 text-gray-500',    outbound: true },
  { value: 'sent',      label: 'Sent',      color: 'bg-blue-50 text-blue-700',     outbound: true },
  { value: 'delivered', label: 'Delivered', color: 'bg-indigo-50 text-indigo-700', outbound: true },
  { value: 'read',      label: 'Read',      color: 'bg-green-50 text-green-700',   outbound: true },
  { value: 'failed',    label: 'Failed',    color: 'bg-red-50 text-red-500',       outbound: true },
  { value: 'received',  label: 'Received',  color: 'bg-emerald-50 text-emerald-700', outbound: false },
]

export const WA_TONE_OPTIONS: {
  value: GenerateWhatsAppRequest['tone']
  label: string
  description: string
}[] = [
  { value: 'friendly',     label: 'Friendly',     description: 'Warm, first-name basis, casual' },
  { value: 'professional', label: 'Professional', description: 'Polished, concise, no jargon' },
  { value: 'value-first',  label: 'Value First',  description: 'Lead with a concrete benefit' },
  { value: 'curiosity',    label: 'Curiosity',    description: 'Open with an intriguing question' },
]
