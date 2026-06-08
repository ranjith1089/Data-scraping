import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnrichmentResult {
  lead_id: string
  status: 'success' | 'partial' | 'failed' | 'no_api_key' | 'not_found'
  source: string
  fields_found: Record<string, string>
  fields_updated: string[]
  skipped_fields: string[]
  message: string
}

export interface BulkEnrichResult {
  results: EnrichmentResult[]
  total: number
  enriched: number
  not_found: number
  failed: number
}

export interface EnrichmentLog {
  id: string
  lead_id: string
  source: string
  fields_found: Record<string, string> | null
  fields_updated: string[] | null
  status: string
  error: string | null
  created_at: string
}

// ─── Single lead enrichment ───────────────────────────────────────────────────

/** Enrich a single lead. Invalidates the lead query on success so UI refreshes. */
export function useEnrichLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      leadId,
      overwrite = false,
    }: {
      leadId: string
      overwrite?: boolean
    }) => {
      const { data } = await api.post<EnrichmentResult>(`/leads/${leadId}/enrich`, {
        overwrite,
      })
      return data
    },
    onSuccess: (_data, variables) => {
      // Refresh lead detail so enriched fields appear immediately
      qc.invalidateQueries({ queryKey: ['lead', variables.leadId] })
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

// ─── Bulk enrichment ──────────────────────────────────────────────────────────

export function useBulkEnrichLeads() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      leadIds,
      overwrite = false,
    }: {
      leadIds: string[]
      overwrite?: boolean
    }) => {
      const { data } = await api.post<BulkEnrichResult>('/leads/bulk-enrich', {
        lead_ids: leadIds,
        overwrite,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

// ─── Enrichment history ───────────────────────────────────────────────────────

export function useEnrichmentLogs(leadId: string) {
  return useQuery({
    queryKey: ['enrichment-logs', leadId],
    queryFn: async () => {
      const { data } = await api.get<EnrichmentLog[]>(`/leads/${leadId}/enrichment-logs`)
      return data
    },
    enabled: !!leadId,
  })
}

// ─── Field label map ─────────────────────────────────────────────────────────

export const FIELD_LABELS: Record<string, string> = {
  email:        'Email',
  phone:        'Phone',
  linkedin_url: 'LinkedIn',
  designation:  'Designation',
  company_size: 'Company Size',
  website:      'Website',
  industry:     'Industry',
}
