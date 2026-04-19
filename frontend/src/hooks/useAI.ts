import { useMutation, useQuery } from '@tanstack/react-query'
import api, { API_URL } from '../lib/api'
import { useAIStore, type ChatMessage } from '../store/aiStore'
import { useAuthStore } from '../store/authStore'

// --- Email Generation ---

export interface EmailGenRequest {
  lead_id: string
  email_type: 'cold_outreach' | 'follow_up' | 'proposal' | 'custom'
  context?: string
  tone?: 'formal' | 'friendly' | 'persuasive'
  language?: string
}

export interface EmailGenResponse {
  subject: string
  body: string
  lead_id: string
  tokens_used: number
}

export function useEmailGen() {
  return useMutation({
    mutationFn: async (request: EmailGenRequest) => {
      const { data } = await api.post<EmailGenResponse>(
        '/ai/generate-email',
        request
      )
      return data
    },
  })
}

// --- Lead Scoring ---

export interface ScoreRequest {
  lead_ids: string[]
}

export interface ScoreResult {
  lead_id: string
  score: number
  icp_fit: string
  reasoning: string
  factors: {
    factor: string
    impact: 'positive' | 'negative' | 'neutral'
    weight: number
  }[]
}

export function useLeadScore() {
  return useMutation({
    mutationFn: async (request: ScoreRequest) => {
      const { data } = await api.post<{ results: ScoreResult[] }>(
        '/ai/score-leads',
        request
      )
      return data.results
    },
  })
}

// --- Sector Brief ---

export interface SectorBrief {
  sector_code: string
  sector_name: string
  summary: string
  key_trends: string[]
  opportunities: string[]
  challenges: string[]
  recommended_approach: string
  top_companies: string[]
  market_size_estimate: string
  growth_rate: string
  generated_at: string
}

export function useSectorBrief(sectorCode: string) {
  return useQuery({
    queryKey: ['sector-brief', sectorCode],
    queryFn: async () => {
      const { data } = await api.get<SectorBrief>(
        `/ai/sector-brief/${sectorCode}`
      )
      return data
    },
    enabled: !!sectorCode,
    staleTime: 5 * 60 * 1000,
  })
}

// --- Sector Analysis (expansion recommendations from won leads) ---

export interface SectorRecommendation {
  sector_code: string
  sector_name: string
  fit_score: number
  rationale: string
  signals: string[]
  recommended_icp?: string | null
  sample_designations: string[]
}

export interface SectorMixRow {
  sector_code: string
  sector_name: string
  won_count: number
  won_value_inr: number
}

export interface SectorAnalysis {
  summary: string
  current_sector_mix: SectorMixRow[]
  recommendations: SectorRecommendation[]
  generated_at: string
  based_on_won_leads: number
}

export function useSectorAnalysis() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<SectorAnalysis>('/ai/sector-analysis')
      return data
    },
  })
}

// --- Chat with SSE Streaming ---

export function useChat() {
  const { addMessage, appendToLastMessage, setStreaming } = useAIStore()
  const accessToken = useAuthStore((s) => s.accessToken)

  const sendMessage = async (
    message: string,
    leadId?: string,
    history?: ChatMessage[]
  ) => {
    // Add user message to store
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date(),
      leadId,
    })

    // Add empty assistant message to stream into
    const assistantId = crypto.randomUUID()
    addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      leadId,
    })
    setStreaming(true)

    try {
      const conversationHistory = (history || []).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message,
          lead_id: leadId,
          conversation_history: conversationHistory,
        }),
      })

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                appendToLastMessage(parsed.text)
              }
              if (parsed.error) {
                appendToLastMessage(`\n\n[Error: ${parsed.error}]`)
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error'
      appendToLastMessage(`\n\n[Error connecting to AI assistant: ${errorMessage}]`)
    } finally {
      setStreaming(false)
    }
  }

  return { sendMessage }
}

// --- Personalise Batch ---

export interface PersonaliseRequest {
  lead_ids: string[]
  template: string
  channel: 'email' | 'whatsapp' | 'sms'
}

export interface PersonalisedMessage {
  lead_id: string
  personalised_content: string
  subject?: string
  tokens_used: number
}

export function usePersonalise() {
  return useMutation({
    mutationFn: async (request: PersonaliseRequest) => {
      const { data } = await api.post<{ messages: PersonalisedMessage[] }>(
        '/ai/personalise-batch',
        request
      )
      return data.messages
    },
  })
}

// --- Reply Analyser ---

export interface ReplyAnalysisRequest {
  lead_id: string
  reply_text: string
  original_message?: string
}

export interface ReplyAnalysis {
  lead_id: string
  sentiment: 'positive' | 'neutral' | 'negative'
  intent: 'interested' | 'not_interested' | 'needs_info' | 'objection' | 'meeting_request'
  key_points: string[]
  suggested_response: string
  suggested_stage: string
  urgency: 'high' | 'medium' | 'low'
  confidence: number
}

export function useReplyAnalyser() {
  return useMutation({
    mutationFn: async (request: ReplyAnalysisRequest) => {
      const { data } = await api.post<ReplyAnalysis>(
        '/ai/analyse-reply',
        request
      )
      return data
    },
  })
}
