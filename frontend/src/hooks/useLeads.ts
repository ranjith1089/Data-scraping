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

export interface Lead {
  id: string
  tenant_id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  sector_code: string
  city: string
  district: string
  state: string
  company_size: string
  annual_revenue: number | null
  website: string | null
  lead_source: string
  stage: string
  ai_score: number
  icp_fit: string
  assigned_to: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface LeadListResponse {
  items: Lead[]
  total: number
  page: number
  per_page: number
  pages: number
}

export function useLeads(params: LeadSearchParams = {}) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: async () => {
      const { data } = await api.get<LeadListResponse>('/leads/', { params })
      return data
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
