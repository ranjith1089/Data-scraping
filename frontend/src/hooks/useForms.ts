import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface CustomFieldDef {
  key: string
  label: string
  required: boolean
  type: 'text'
}

export interface PublicForm {
  id: string
  tenant_id: string
  name: string
  public_token: string
  sector_code: string
  redirect_url: string | null
  custom_field_schema: CustomFieldDef[] | null
  is_active: boolean
  submission_count: number
  created_at: string
  updated_at: string
}

export interface PublicFormEmbed {
  public_token: string
  script_snippet: string
  iframe_snippet: string
  submit_url: string
}

export interface PublicFormCreatePayload {
  name: string
  sector_code: string
  redirect_url?: string
  custom_field_schema?: CustomFieldDef[]
}

export interface PublicFormUpdatePayload {
  name?: string
  sector_code?: string
  redirect_url?: string
  custom_field_schema?: CustomFieldDef[]
  is_active?: boolean
}

export function useForms() {
  return useQuery({
    queryKey: ['public-forms'],
    queryFn: async () => {
      const { data } = await api.get<PublicForm[]>('/public-forms/')
      return data
    },
  })
}

export function useCreateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: PublicFormCreatePayload) => {
      const { data } = await api.post<PublicForm>('/public-forms/', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['public-forms'] }),
  })
}

export function useUpdateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: PublicFormUpdatePayload & { id: string }) => {
      const { data } = await api.patch<PublicForm>(`/public-forms/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['public-forms'] }),
  })
}

export function useDeleteForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/public-forms/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['public-forms'] }),
  })
}

export function useFormEmbed(id: string | null) {
  return useQuery({
    queryKey: ['public-form-embed', id],
    queryFn: async () => {
      const { data } = await api.get<PublicFormEmbed>(
        `/public-forms/${id}/embed`,
      )
      return data
    },
    enabled: !!id,
  })
}
