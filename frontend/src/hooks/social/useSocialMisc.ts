/**
 * Smaller hooks bundled together to keep the file count down.
 * Posts, campaigns, templates, analytics, consents.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

// -- Posts ---------------------------------------------------------------

export interface SocialPost {
  id: string
  platform: string
  external_post_id: string
  permalink: string | null
  caption: string | null
  media_url: string | null
  posted_at: string | null
  created_at: string
}

export function useSocialPosts() {
  return useQuery({
    queryKey: ['social', 'posts'],
    queryFn: async () => {
      const { data } = await api.get<SocialPost[]>('/social/posts/')
      return data
    },
  })
}

export function useRefreshPosts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<SocialPost[]>('/social/posts/refresh')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social', 'posts'] }),
  })
}

// -- Campaigns -----------------------------------------------------------

export interface SocialCampaign {
  id: string
  name: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  goal: string | null
  posts: SocialPost[]
  rule_count: number
  created_at: string
}

export function useSocialCampaigns() {
  return useQuery({
    queryKey: ['social', 'campaigns'],
    queryFn: async () => {
      const { data } = await api.get<SocialCampaign[]>('/social/campaigns/')
      return data
    },
  })
}

export function useCreateSocialCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      name: string
      goal?: 'lead_capture' | 'engagement' | 'broadcast'
      post_ids?: string[]
    }) => {
      const { data } = await api.post<SocialCampaign>(
        '/social/campaigns/',
        body,
      )
      return data
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['social', 'campaigns'] }),
  })
}

export function useUpdateSocialCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      id: string
      body: { name?: string; status?: string; post_ids?: string[] }
    }) => {
      const { data } = await api.patch<SocialCampaign>(
        `/social/campaigns/${vars.id}`,
        vars.body,
      )
      return data
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['social', 'campaigns'] }),
  })
}

export function useDeleteSocialCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/social/campaigns/${id}`)
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['social', 'campaigns'] }),
  })
}

// -- Templates -----------------------------------------------------------

export interface SocialTemplate {
  id: string
  name: string
  content: string
  language: 'en' | 'ta' | 'hi'
  variables: Array<Record<string, unknown>> | null
  created_at: string
}

export function useTemplates() {
  return useQuery({
    queryKey: ['social', 'templates'],
    queryFn: async () => {
      const { data } = await api.get<SocialTemplate[]>('/social/templates/')
      return data
    },
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      name: string
      content: string
      language: 'en' | 'ta' | 'hi'
    }) => {
      const { data } = await api.post<SocialTemplate>(
        '/social/templates/',
        body,
      )
      return data
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['social', 'templates'] }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/social/templates/${id}`)
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['social', 'templates'] }),
  })
}

// -- Analytics -----------------------------------------------------------

export interface SocialAnalyticsOverview {
  period_days: number
  dms_sent: number
  dms_delivered: number
  dms_failed: number
  leads_created: number
  conversion_rate: number
  avg_response_time_seconds: number | null
  open_conversations: number
}

export interface RuleMetrics {
  rule_id: string
  rule_name: string
  fired_count: number
  leads_created: number
  success_rate: number
}

export interface FunnelStage {
  stage: string
  count: number
}

export function useSocialOverview(periodDays = 30) {
  return useQuery({
    queryKey: ['social', 'analytics', 'overview', periodDays],
    queryFn: async () => {
      const { data } = await api.get<SocialAnalyticsOverview>(
        '/social/analytics/overview',
        { params: { period_days: periodDays } },
      )
      return data
    },
  })
}

export function useSocialByRule(periodDays = 30) {
  return useQuery({
    queryKey: ['social', 'analytics', 'by-rule', periodDays],
    queryFn: async () => {
      const { data } = await api.get<{ rules: RuleMetrics[] }>(
        '/social/analytics/by-rule',
        { params: { period_days: periodDays } },
      )
      return data
    },
  })
}

export function useSocialFunnel(periodDays = 30) {
  return useQuery({
    queryKey: ['social', 'analytics', 'funnel', periodDays],
    queryFn: async () => {
      const { data } = await api.get<{ stages: FunnelStage[] }>(
        '/social/analytics/funnel',
        { params: { period_days: periodDays } },
      )
      return data
    },
  })
}
