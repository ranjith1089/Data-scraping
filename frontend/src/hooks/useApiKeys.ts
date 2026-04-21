import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface APIKeyRow {
  id: string
  name: string
  preview: string
  last_used: string | null
  created_at: string
}

export interface APIKeyCreated extends APIKeyRow {
  key: string // plaintext, shown once
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data } = await api.get<APIKeyRow[]>('/api-keys/')
      return data
    },
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<APIKeyCreated>('/api-keys/', { name })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

export function useDeleteApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api-keys/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}
