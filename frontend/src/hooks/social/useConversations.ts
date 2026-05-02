import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export interface SocialAccount {
  id: string
  platform: string
  external_user_id: string
  handle: string | null
  display_name: string | null
  profile_picture_url: string | null
  lead_id: string | null
  first_seen_at: string
  last_seen_at: string
}

export interface SocialMessage {
  id: string
  conversation_id: string
  platform: string
  direction: 'inbound' | 'outbound'
  source: string
  external_message_id: string | null
  content: string | null
  attachments: Array<Record<string, unknown>> | null
  trigger_post_id: string | null
  rule_id: string | null
  status: string
  error: string | null
  received_at: string | null
  sent_at: string | null
  created_at: string
}

export interface Conversation {
  id: string
  platform: string
  status: 'open' | 'snoozed' | 'closed'
  assigned_to: string | null
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  account: SocialAccount
  created_at: string
  updated_at: string
}

export interface ConversationDetail extends Conversation {
  messages: SocialMessage[]
}

export function useConversations(params: {
  platform?: string
  convo_status?: string
  q?: string
  limit?: number
} = {}) {
  return useQuery({
    queryKey: ['social', 'conversations', params],
    queryFn: async () => {
      const { data } = await api.get<Conversation[]>(
        '/social/conversations/',
        { params },
      )
      return data
    },
  })
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['social', 'conversation', id],
    queryFn: async () => {
      const { data } = await api.get<ConversationDetail>(
        `/social/conversations/${id}`,
      )
      return data
    },
    enabled: !!id,
    refetchInterval: 15_000,
  })
}

export function useSendManualMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { conversationId: string; content: string }) => {
      const { data } = await api.post<SocialMessage>(
        `/social/conversations/${vars.conversationId}/messages`,
        { content: vars.content },
      )
      return data
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({
        queryKey: ['social', 'conversation', v.conversationId],
      })
      qc.invalidateQueries({ queryKey: ['social', 'conversations'] })
    },
  })
}

export function useUpdateConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      id: string
      body: { status?: string; assigned_to?: string }
    }) => {
      const { data } = await api.patch<Conversation>(
        `/social/conversations/${vars.id}`,
        vars.body,
      )
      return data
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['social', 'conversations'] }),
  })
}

export function usePromoteConversation() {
  return useMutation({
    mutationFn: async (vars: {
      id: string
      sector_code: string
      tags?: string[]
    }) => {
      const { data } = await api.post(
        `/social/conversations/${vars.id}/promote`,
        { sector_code: vars.sector_code, tags: vars.tags ?? [] },
      )
      return data as { detail: string; lead_id: string }
    },
  })
}
