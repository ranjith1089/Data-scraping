import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export type SocialTriggerType =
  | 'comment.received'
  | 'dm.received'
  | 'story_reply.received'
  | 'story_reaction.received'
  | 'mention.received'

export type SocialActionType =
  | 'send_dm'
  | 'send_dm_with_quick_replies'
  | 'create_lead'
  | 'tag_lead'
  | 'assign_lead'
  | 'update_stage'
  | 'apply_follow_gate'
  | 'wait_for_event'
  | 'create_activity'
  | 'send_email'
  | 'send_whatsapp'
  | 'webhook_publish'

export type ConditionOp =
  | 'eq'
  | 'neq'
  | 'in'
  | 'not_in'
  | 'contains_any'
  | 'not_contains_any'
  | 'matches_regex'
  | 'exists'
  | 'not_exists'

export interface RuleCondition {
  field: string
  op: ConditionOp
  value?: unknown
}

export interface RuleAction {
  type: SocialActionType
  config: Record<string, unknown>
}

export interface AutomationRule {
  id: string
  tenant_id: string
  name: string
  platform: string | null
  campaign_id: string | null
  trigger_type: string
  trigger_config: Record<string, unknown> | null
  conditions: RuleCondition[] | null
  actions: RuleAction[] | null
  priority: number
  cooldown_minutes: number
  enabled: boolean
  run_count: number
  last_run_at: string | null
  created_at: string
}

export interface AutomationRuleCreatePayload {
  name: string
  platform?: 'instagram' | 'facebook' | 'whatsapp'
  campaign_id?: string | null
  trigger_type: SocialTriggerType
  trigger_config?: Record<string, unknown>
  conditions?: RuleCondition[]
  actions: RuleAction[]
  priority?: number
  cooldown_minutes?: number
  enabled?: boolean
}

export interface AutomationRuleUpdatePayload {
  name?: string
  campaign_id?: string | null
  trigger_config?: Record<string, unknown>
  conditions?: RuleCondition[]
  actions?: RuleAction[]
  priority?: number
  cooldown_minutes?: number
  enabled?: boolean
}

export interface RuleTestResult {
  matched: boolean
  reasons: string[]
  simulated_actions: Array<Record<string, unknown>>
}

export function useAutomations(params: {
  platform?: string
  campaign_id?: string
  enabled?: boolean
} = {}) {
  return useQuery({
    queryKey: ['social', 'automations', params],
    queryFn: async () => {
      const { data } = await api.get<AutomationRule[]>('/social/automations/', {
        params,
      })
      return data
    },
  })
}

export function useAutomation(id: string | null) {
  return useQuery({
    queryKey: ['social', 'automation', id],
    queryFn: async () => {
      const { data } = await api.get<AutomationRule>(
        `/social/automations/${id}`,
      )
      return data
    },
    enabled: !!id,
  })
}

export function useCreateAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: AutomationRuleCreatePayload) => {
      const { data } = await api.post<AutomationRule>(
        '/social/automations/',
        body,
      )
      return data
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['social', 'automations'] }),
  })
}

export function useUpdateAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { id: string; body: AutomationRuleUpdatePayload }) => {
      const { data } = await api.patch<AutomationRule>(
        `/social/automations/${vars.id}`,
        vars.body,
      )
      return data
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['social', 'automations'] })
      qc.invalidateQueries({ queryKey: ['social', 'automation', v.id] })
    },
  })
}

export function useDeleteAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/social/automations/${id}`)
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['social', 'automations'] }),
  })
}

export function useTestAutomation() {
  return useMutation({
    mutationFn: async (vars: { id: string; sample_event: Record<string, unknown> }) => {
      const { data } = await api.post<RuleTestResult>(
        `/social/automations/${vars.id}/test`,
        { sample_event: vars.sample_event },
      )
      return data
    },
  })
}

export function useReplayAutomation() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/social/automations/${id}/replay`)
      return data
    },
  })
}
