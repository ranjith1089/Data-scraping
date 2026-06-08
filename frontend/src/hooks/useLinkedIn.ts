import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LinkedInMessage {
  id: string
  tenant_id: string
  lead_id: string
  created_by: string | null
  connection_note: string
  followup_message: string | null
  status: 'draft' | 'sent' | 'connected' | 'replied' | 'ignored'
  ai_generated: boolean
  ai_tone: string | null
  linkedin_headline: string | null
  linkedin_summary: string | null
  sent_at: string | null
  connected_at: string | null
  replied_at: string | null
  created_at: string
  updated_at: string
  // Enriched from lead join
  lead_company: string | null
  lead_contact: string | null
  lead_linkedin_url: string | null
  lead_designation: string | null
  lead_sector_code: string | null
}

export interface LinkedInEnrichResult {
  headline: string | null
  summary: string | null
  skills: string[]
  location: string | null
  follower_count: number | null
  connections: number | null
  source: string
  warning: string | null
}

export interface GenerateLinkedInMessageRequest {
  tone: 'professional' | 'friendly' | 'value-first' | 'curiosity'
  context?: string
  include_followup?: boolean
}

export interface UpdateLinkedInMessageRequest {
  connection_note?: string
  followup_message?: string
  status?: 'draft' | 'sent' | 'connected' | 'replied' | 'ignored'
  sent_at?: string
  connected_at?: string
  replied_at?: string
  linkedin_headline?: string
  linkedin_summary?: string
}

// ─── Query keys ───────────────────────────────────────────────────────────────

const KEYS = {
  all: ['linkedin'] as const,
  messages: (leadId?: string) =>
    leadId ? [...KEYS.all, 'messages', leadId] : [...KEYS.all, 'messages'],
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** All messages for a specific lead */
export function useLeadLinkedInMessages(leadId: string) {
  return useQuery<LinkedInMessage[]>({
    queryKey: KEYS.messages(leadId),
    queryFn: async () => {
      const { data } = await api.get<LinkedInMessage[]>(
        `/linkedin/leads/${leadId}/messages`
      )
      return data
    },
    enabled: !!leadId,
  })
}

/** Global messages list (for the LinkedIn outreach page) */
export function useAllLinkedInMessages(status?: string) {
  return useQuery<LinkedInMessage[]>({
    queryKey: [...KEYS.messages(), status ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string> = { limit: '100' }
      if (status) params.status = status
      const { data } = await api.get<LinkedInMessage[]>('/linkedin/messages', { params })
      return data
    },
  })
}

/** AI-generate a connection note + follow-up for a lead */
export function useGenerateLinkedInMessage(leadId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: GenerateLinkedInMessageRequest) => {
      const { data } = await api.post<LinkedInMessage>(
        `/linkedin/leads/${leadId}/messages/generate`,
        req
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.messages(leadId) })
      qc.invalidateQueries({ queryKey: KEYS.messages() })
    },
  })
}

/** Update a message (status, text, timestamps) */
export function useUpdateLinkedInMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: UpdateLinkedInMessageRequest
    }) => {
      const { data } = await api.patch<LinkedInMessage>(
        `/linkedin/messages/${id}`,
        updates
      )
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: KEYS.messages(data.lead_id) })
      qc.invalidateQueries({ queryKey: KEYS.messages() })
    },
  })
}

/** Delete a message */
export function useDeleteLinkedInMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/linkedin/messages/${id}`)
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

/** Enrich a lead's LinkedIn profile via ProxyCurl */
export function useEnrichLinkedInProfile(leadId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<LinkedInEnrichResult>(
        `/linkedin/leads/${leadId}/enrich`
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.messages(leadId) })
    },
  })
}

// ─── Static data ─────────────────────────────────────────────────────────────

export const LINKEDIN_STATUSES: {
  value: LinkedInMessage['status']
  label: string
  color: string
}[] = [
  { value: 'draft',     label: 'Draft',     color: 'bg-gray-100 text-gray-600' },
  { value: 'sent',      label: 'Sent',      color: 'bg-blue-50 text-blue-700' },
  { value: 'connected', label: 'Connected', color: 'bg-indigo-50 text-indigo-700' },
  { value: 'replied',   label: 'Replied',   color: 'bg-green-50 text-green-700' },
  { value: 'ignored',   label: 'Ignored',   color: 'bg-red-50 text-red-500' },
]

export const TONE_OPTIONS: {
  value: GenerateLinkedInMessageRequest['tone']
  label: string
  description: string
}[] = [
  { value: 'professional', label: 'Professional', description: 'Credibility-first, no fluff' },
  { value: 'friendly',     label: 'Friendly',     description: 'Warm peer-to-peer tone' },
  { value: 'value-first',  label: 'Value First',  description: 'Lead with a specific insight' },
  { value: 'curiosity',    label: 'Curiosity',    description: 'Open with an intriguing question' },
]
