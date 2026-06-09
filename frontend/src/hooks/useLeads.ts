import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'

export interface LeadSearchParams {
  sector_code?: string
  stage?: string
  min_score?: number
  max_score?: number
  district?: string
  city?: string
  company_size?: string
  assigned_to?: string
  search?: string
  page?: number
  per_page?: number
}

// Mirrors backend/schemas/lead.py::LeadResponse exactly. Historical drift
// had this interface using contact_email / contact_phone / annual_revenue
// / lead_source / ai_score / icp_fit — fields the backend doesn't return.
// Every such read was undefined at runtime, so (for example) the
// LeadDrawer's Contact Information section hid Email and Phone even
// when the row had them. Don't add fields unless the backend response
// actually includes them.
export interface Lead {
  id: string
  tenant_id: string
  sector_code: string
  company_name: string
  industry: string | null
  sub_industry: string | null
  state: string | null
  district: string | null
  city: string | null
  address: string | null
  pincode: string | null
  website: string | null
  company_size: string | null
  annual_revenue_inr: number | null
  contact_name: string | null
  designation: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  tags: string[]
  source: string | null
  custom_fields: Record<string, unknown> | null
  lead_score: number | null
  score_reason: string | null
  icp_match: string | null
  ai_summary: string | null
  stage: string
  assigned_to: string | null
  created_at: string
  updated_at: string | null
  // ── Admission / student fields ─────────────────────────────────────
  parent_name: string | null
  parent_phone: string | null
  course_interested: string | null
  board: string | null
  stream: string | null
  percentage_marks: number | null
  school_name: string | null
}

// Backend returns {items, total, page, per_page, total_pages}. The
// `pages` alias below is populated in the hook so callers can stay on
// the frontend-friendly name.
export interface LeadListResponse {
  items: Lead[]
  total: number
  page: number
  per_page: number
  pages: number
}

interface RawLeadListResponse {
  items: Lead[]
  total: number
  page: number
  per_page: number
  total_pages?: number
  pages?: number
}

export function useLeads(params: LeadSearchParams = {}) {
  return useQuery<LeadListResponse>({
    queryKey: ['leads', params],
    queryFn: async () => {
      const { data } = await api.get<RawLeadListResponse>('/leads/', { params })
      return {
        items: data.items ?? [],
        total: data.total ?? 0,
        page: data.page ?? 1,
        per_page: data.per_page ?? 20,
        // Accept either `total_pages` (current backend) or `pages` (future).
        pages: data.total_pages ?? data.pages ?? 1,
      }
    },
  })
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data } = await api.get<Lead>(`/leads/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (lead: Partial<Lead>) => {
      const { data } = await api.post<Lead>('/leads/', lead)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lead> & { id: string }) => {
      const { data } = await api.patch<Lead>(`/leads/${id}`, updates)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['lead', variables.id] })
    },
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/leads/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useBulkUpdateLeads() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      lead_ids: string[]
      updates: Partial<Lead>
    }) => {
      const { data } = await api.post('/leads/bulk-update', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useImportCSV() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/import/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}
