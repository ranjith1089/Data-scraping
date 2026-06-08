import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SequenceStep {
  id: string
  sequence_id: string
  tenant_id: string
  step_order: number
  delay_days: number
  subject: string
  body: string
  email_type: string
  ai_tone: string
  created_at: string
  updated_at: string
}

export interface EmailSequence {
  id: string
  tenant_id: string
  name: string
  description: string | null
  status: 'draft' | 'active' | 'paused' | 'archived'
  created_by: string | null
  created_at: string
  updated_at: string
  step_count: number
  enrolled_count: number
  active_count: number
  completed_count: number
  reply_count: number
}

export interface EmailSequenceDetail extends EmailSequence {
  steps: SequenceStep[]
}

export interface SequenceEnrollment {
  id: string
  sequence_id: string
  lead_id: string
  tenant_id: string
  enrolled_by: string | null
  status: 'active' | 'paused' | 'completed' | 'unsubscribed' | 'replied' | 'bounced' | 'failed'
  current_step: number
  next_step_at: string | null
  enrolled_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
  lead_company: string | null
  lead_contact: string | null
  lead_email: string | null
  sequence_name: string | null
}

export interface StepStat {
  step_order: number
  subject: string
  sent: number
  opened: number
  replied: number
  open_rate: number
  reply_rate: number
}

export interface SequenceStats {
  sequence_id: string
  total_enrolled: number
  active: number
  completed: number
  unsubscribed: number
  total_sent: number
  total_opened: number
  total_replied: number
  overall_open_rate: number
  overall_reply_rate: number
  per_step: StepStat[]
}

export interface CreateSequenceRequest {
  name: string
  description?: string
}

export interface UpdateSequenceRequest {
  name?: string
  description?: string
  status?: EmailSequence['status']
}

export interface CreateStepRequest {
  step_order: number
  delay_days: number
  subject: string
  body: string
  email_type?: string
  ai_tone?: string
}

export interface UpdateStepRequest {
  step_order?: number
  delay_days?: number
  subject?: string
  body?: string
  email_type?: string
  ai_tone?: string
}

// ─── Query keys ───────────────────────────────────────────────────────────────

const KEYS = {
  all: ['email-sequences'] as const,
  list: (status?: string) => ['email-sequences', 'list', status ?? 'all'] as const,
  detail: (id: string) => ['email-sequences', id] as const,
  enrollments: (seqId: string) => ['email-sequences', seqId, 'enrollments'] as const,
  stats: (seqId: string) => ['email-sequences', seqId, 'stats'] as const,
  leadEnrollments: (leadId: string) => ['email-sequences', 'lead', leadId] as const,
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useEmailSequences(status?: string) {
  return useQuery<EmailSequence[]>({
    queryKey: KEYS.list(status),
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (status) params.status = status
      const { data } = await api.get<EmailSequence[]>('/email-sequences', { params })
      return data
    },
  })
}

export function useEmailSequenceDetail(id: string) {
  return useQuery<EmailSequenceDetail>({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get<EmailSequenceDetail>(`/email-sequences/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useSequenceEnrollments(seqId: string, status?: string) {
  return useQuery<SequenceEnrollment[]>({
    queryKey: KEYS.enrollments(seqId),
    queryFn: async () => {
      const params: Record<string, string> = { limit: '100' }
      if (status) params.status = status
      const { data } = await api.get<SequenceEnrollment[]>(
        `/email-sequences/${seqId}/enrollments`,
        { params }
      )
      return data
    },
    enabled: !!seqId,
  })
}

export function useSequenceStats(seqId: string) {
  return useQuery<SequenceStats>({
    queryKey: KEYS.stats(seqId),
    queryFn: async () => {
      const { data } = await api.get<SequenceStats>(`/email-sequences/${seqId}/stats`)
      return data
    },
    enabled: !!seqId,
  })
}

export function useLeadEnrollments(leadId: string) {
  return useQuery<SequenceEnrollment[]>({
    queryKey: KEYS.leadEnrollments(leadId),
    queryFn: async () => {
      // Use the global enrollments list filtered by lead (via enrollments endpoint)
      // We iterate sequences and check enrollments — alternatively we can
      // call a lead-specific endpoint if we add one later.
      // For now, query global enrollments filtered by searching enrollments
      // from all sequences. This is a frontend workaround until a
      // GET /leads/{id}/enrollments endpoint is added in Phase 6.1.
      // We'll query the enrollments of all sequences and filter by lead_id client-side.
      const { data } = await api.get<SequenceEnrollment[]>('/email-sequences/enrollments/by-lead', {
        params: { lead_id: leadId },
      }).catch(() => ({ data: [] as SequenceEnrollment[] }))
      return data
    },
    enabled: !!leadId,
  })
}

export function useCreateSequence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: CreateSequenceRequest) => {
      const { data } = await api.post<EmailSequence>('/email-sequences', req)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useUpdateSequence(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: UpdateSequenceRequest) => {
      const { data } = await api.patch<EmailSequence>(`/email-sequences/${id}`, req)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
      qc.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

export function useDeleteSequence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/email-sequences/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useAddStep(seqId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: CreateStepRequest) => {
      const { data } = await api.post<SequenceStep>(`/email-sequences/${seqId}/steps`, req)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.detail(seqId) }),
  })
}

export function useUpdateStep(seqId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ stepId, req }: { stepId: string; req: UpdateStepRequest }) => {
      const { data } = await api.patch<SequenceStep>(
        `/email-sequences/${seqId}/steps/${stepId}`,
        req
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.detail(seqId) }),
  })
}

export function useDeleteStep(seqId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (stepId: string) => {
      await api.delete(`/email-sequences/${seqId}/steps/${stepId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.detail(seqId) }),
  })
}

export function useEnrollLead(seqId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data } = await api.post<SequenceEnrollment>(`/email-sequences/${seqId}/enroll`, {
        lead_id: leadId,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.enrollments(seqId) })
      qc.invalidateQueries({ queryKey: KEYS.detail(seqId) })
      qc.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

export function useUpdateEnrollment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      enrollmentId,
      status,
    }: {
      enrollmentId: string
      status: string
    }) => {
      const { data } = await api.patch<SequenceEnrollment>(`/enrollments/${enrollmentId}`, {
        status,
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

// ─── Static data ─────────────────────────────────────────────────────────────

export const SEQUENCE_STATUSES = [
  { value: 'draft',    label: 'Draft',    color: 'bg-gray-100 text-gray-600' },
  { value: 'active',   label: 'Active',   color: 'bg-green-50 text-green-700' },
  { value: 'paused',   label: 'Paused',   color: 'bg-amber-50 text-amber-700' },
  { value: 'archived', label: 'Archived', color: 'bg-red-50 text-red-400' },
]

export const ENROLLMENT_STATUSES = [
  { value: 'active',       label: 'Active',       color: 'bg-green-50 text-green-700' },
  { value: 'paused',       label: 'Paused',       color: 'bg-amber-50 text-amber-700' },
  { value: 'completed',    label: 'Completed',    color: 'bg-indigo-50 text-indigo-700' },
  { value: 'replied',      label: 'Replied',      color: 'bg-blue-50 text-blue-700' },
  { value: 'unsubscribed', label: 'Unsubscribed', color: 'bg-gray-100 text-gray-500' },
  { value: 'bounced',      label: 'Bounced',      color: 'bg-red-50 text-red-500' },
  { value: 'failed',       label: 'Failed',       color: 'bg-red-50 text-red-400' },
]

export const EMAIL_TYPES = [
  { value: 'cold_outreach', label: 'Cold Outreach' },
  { value: 'follow_up',     label: 'Follow-Up' },
  { value: 'value_add',     label: 'Value Add' },
  { value: 'breakup',       label: 'Break-Up' },
]

export const AI_TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly',     label: 'Friendly' },
  { value: 'formal',       label: 'Formal' },
  { value: 'consultative', label: 'Consultative' },
]
