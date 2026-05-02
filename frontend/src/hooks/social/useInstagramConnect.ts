import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface InstagramConnectionStatus {
  connected: boolean
  instagram_business_id: string | null
  page_id: string | null
  handle: string | null
  webhook_url: string | null
  connected_at: string | null
  last_test_at: string | null
  last_test_ok: boolean | null
}

export interface OAuthStartResponse {
  auth_url: string
  state: string
}

/** Connect status for the /social/connect page. */
export function useInstagramStatus() {
  return useQuery({
    queryKey: ['social', 'ig-status'],
    queryFn: async () => {
      const { data } = await api.get<InstagramConnectionStatus>(
        '/social/oauth/instagram/status',
      )
      return data
    },
  })
}

/** Returns the auth URL the browser should redirect to. */
export function useStartInstagramOAuth() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.get<OAuthStartResponse>(
        '/social/oauth/instagram/start',
      )
      return data
    },
  })
}

export function useDisconnectInstagram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete('/social/oauth/instagram')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social', 'ig-status'] }),
  })
}
