import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Proposal {
  id: string
  tenant_id: string
  lead_id: string
  created_by: string | null
  proposal_type: 'service_proposal' | 'project_quote' | 'intro_letter'
  title: string
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
  ai_tone: string
  content_markdown: string | null
  content_html: string | null
  sections: ProposalSections | null
  created_at: string
  updated_at: string
  // Enriched
  lead_company: string | null
  lead_contact: string | null
}

export interface ProposalSections {
  title?: string
  executive_summary?: string
  scope_of_work?: string
  key_deliverables?: string[]
  pricing?: { item: string; description: string; price: string }[]
  timeline?: string
  why_us?: string
  next_steps?: string
  terms?: string
}

export interface GenerateProposalRequest {
  lead_id: string
  proposal_type?: 'service_proposal' | 'project_quote' | 'intro_letter'
  tone?: 'professional' | 'friendly' | 'formal' | 'consultative'
  product_description?: string
}

export interface UpdateProposalRequest {
  title?: string
  status?: 'draft' | 'sent' | 'accepted' | 'rejected'
  content_markdown?: string
  sections?: Partial<ProposalSections>
}

// ─── Query keys ───────────────────────────────────────────────────────────────

const KEYS = {
  all: ['proposals'] as const,
  list: (leadId?: string) => [...KEYS.all, 'list', leadId ?? 'all'] as const,
  detail: (id: string) => [...KEYS.all, 'detail', id] as const,
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** List proposals, optionally filtered to a single lead. */
export function useProposals(leadId?: string) {
  return useQuery({
    queryKey: KEYS.list(leadId),
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (leadId) params.lead_id = leadId
      const { data } = await api.get<Proposal[]>('/ai/proposals', { params })
      return data
    },
  })
}

/** Fetch a single proposal by ID. */
export function useProposal(id: string) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Proposal>(`/ai/proposals/${id}`)
      return data
    },
    enabled: !!id,
  })
}

/** Generate a new AI proposal. Invalidates the proposals list on success. */
export function useGenerateProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: GenerateProposalRequest) => {
      const { data } = await api.post<Proposal>('/ai/proposals/generate', req)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

/** Update proposal title, status, or sections. */
export function useUpdateProposal(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (req: UpdateProposalRequest) => {
      const { data } = await api.patch<Proposal>(`/ai/proposals/${id}`, req)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
      qc.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

/** Delete a proposal. */
export function useDeleteProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/ai/proposals/${id}`)
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}

/** Open the HTML export URL in a new tab (browser Ctrl+P → save as PDF). */
export function openProposalHtmlExport(id: string) {
  const base = (import.meta.env.VITE_API_URL as string) || ''
  window.open(`${base}/api/v1/ai/proposals/${id}/export/html`, '_blank')
}

/** Trigger the Word (.docx) file download. */
export function downloadProposalDocx(id: string) {
  const base = (import.meta.env.VITE_API_URL as string) || ''
  const a = document.createElement('a')
  a.href = `${base}/api/v1/ai/proposals/${id}/export/docx`
  a.download = ''
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
