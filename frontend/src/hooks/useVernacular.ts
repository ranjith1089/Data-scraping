import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'

export type VernacularLanguage = 'en' | 'ta' | 'hi'
export type VernacularChannel = 'email' | 'sms' | 'whatsapp'

export interface VernacularRequest {
  business_type: string
  audience: string
  tone?: string
  language: VernacularLanguage
  channel?: VernacularChannel
}

export interface VernacularResponse {
  language: VernacularLanguage
  sms: string | null
  whatsapp: string | null
  email_subject: string | null
  email_body: string | null
}

export function useVernacularGenerate() {
  return useMutation({
    mutationFn: async (payload: VernacularRequest) => {
      const { data } = await api.post<VernacularResponse>(
        '/ai/generate-vernacular',
        payload,
      )
      return data
    },
  })
}
