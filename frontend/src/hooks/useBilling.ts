import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface BillingCurrent {
  plan: {
    code: string
    name: string
    price_inr: number
    features: Record<string, unknown>
  }
  limits: {
    users: number
    leads: number
    ai_calls_per_month: number
  }
  usage: {
    users: number
    leads: number
    ai_calls_this_month: number
    ai_tokens_this_month: number
  }
  percent_used: {
    users: number
    leads: number
    ai_calls: number
  }
  next_reset_at: string | null
}

export function useBillingCurrent() {
  return useQuery({
    queryKey: ['billing-current'],
    queryFn: async () => {
      const { data } = await api.get<BillingCurrent>('/billing/current')
      return data
    },
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  })
}

export function useRequestUpgrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (target_plan: 'starter' | 'growth' | 'enterprise') => {
      const { data } = await api.post<{ ok: boolean; message: string }>(
        '/billing/request-upgrade',
        { target_plan },
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-current'] }),
  })
}
