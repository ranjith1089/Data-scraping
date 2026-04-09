import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// ---------------------------------------------------------------------------
// Shared types (mirror backend/schemas/tenant.py admin schemas)
// ---------------------------------------------------------------------------

export type TenantStatus = 'active' | 'suspended' | 'cancelled'

export type PlanType = 'free' | 'starter' | 'professional' | 'enterprise'

export interface AdminTenant {
  id: string
  name: string
  slug: string
  plan: string
  status: TenantStatus
  is_active: boolean
  settings: Record<string, unknown> | null
  owner_id: string | null
  suspended_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string | null
  user_count: number | null
  lead_count: number | null
}

export interface AdminTenantListResponse {
  items: AdminTenant[]
  total: number
  limit: number
  offset: number
}

export interface AdminTenantStats {
  tenant_id: string
  user_count: number
  active_user_count: number
  lead_count: number
  campaign_count: number
  integration_count: number
  last_activity_at: string | null
}

export interface AdminTenantOwnerPayload {
  email: string
  full_name: string
  password: string
}

export interface AdminTenantCreatePayload {
  name: string
  slug: string
  plan?: PlanType
  settings?: Record<string, unknown> | null
  owner?: AdminTenantOwnerPayload | null
}

export interface AdminTenantUpdatePayload {
  name?: string
  plan?: PlanType
  settings?: Record<string, unknown> | null
  owner_id?: string | null
}

export interface AdminUserInTenantCreatePayload {
  email: string
  full_name: string
  password: string
  role?: string
}

export interface AdminUser {
  id: string
  tenant_id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  is_superuser: boolean
  last_login: string | null
  created_at: string
}

export interface AdminTenantListParams {
  q?: string
  status?: TenantStatus
  plan?: string
  limit?: number
  offset?: number
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useAdminTenants(params: AdminTenantListParams = {}) {
  return useQuery({
    queryKey: ['admin', 'tenants', params],
    queryFn: async () => {
      const { data } = await api.get<AdminTenantListResponse>(
        '/admin/tenants/',
        { params },
      )
      return data
    },
  })
}

export function useAdminTenant(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'tenant', id],
    queryFn: async () => {
      const { data } = await api.get<AdminTenant>(`/admin/tenants/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useAdminTenantStats(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'tenant-stats', id],
    queryFn: async () => {
      const { data } = await api.get<AdminTenantStats>(
        `/admin/tenants/${id}/stats`,
      )
      return data
    },
    enabled: !!id,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
  if (id) {
    qc.invalidateQueries({ queryKey: ['admin', 'tenant', id] })
    qc.invalidateQueries({ queryKey: ['admin', 'tenant-stats', id] })
  }
}

export function useCreateAdminTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: AdminTenantCreatePayload) => {
      const { data } = await api.post<AdminTenant>('/admin/tenants/', payload)
      return data
    },
    onSuccess: (data) => invalidate(qc, data.id),
  })
}

export function useUpdateAdminTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: AdminTenantUpdatePayload & { id: string }) => {
      const { data } = await api.patch<AdminTenant>(
        `/admin/tenants/${id}`,
        payload,
      )
      return data
    },
    onSuccess: (_data, variables) => invalidate(qc, variables.id),
  })
}

export function useSuspendTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<AdminTenant>(
        `/admin/tenants/${id}/suspend`,
      )
      return data
    },
    onSuccess: (_data, id) => invalidate(qc, id),
  })
}

export function useReactivateTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<AdminTenant>(
        `/admin/tenants/${id}/reactivate`,
      )
      return data
    },
    onSuccess: (_data, id) => invalidate(qc, id),
  })
}

export function useCancelTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<AdminTenant>(
        `/admin/tenants/${id}/cancel`,
      )
      return data
    },
    onSuccess: (_data, id) => invalidate(qc, id),
  })
}

export function useCreateTenantUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      tenantId,
      ...payload
    }: AdminUserInTenantCreatePayload & { tenantId: string }) => {
      const { data } = await api.post<AdminUser>(
        `/admin/tenants/${tenantId}/users`,
        payload,
      )
      return data
    },
    onSuccess: (_data, variables) => invalidate(qc, variables.tenantId),
  })
}

// ---------------------------------------------------------------------------
// Status presentation helpers
// ---------------------------------------------------------------------------

export const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
}

export const TENANT_STATUS_COLOR: Record<TenantStatus, string> = {
  active: 'border-green-200 bg-green-50 text-green-700',
  suspended: 'border-orange-200 bg-orange-50 text-orange-700',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
}
