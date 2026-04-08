import { useState } from 'react'
import {
  X,
  Loader2,
  Copy,
  Sparkles,
  Brain,
  ChevronDown,
} from 'lucide-react'
import { useReplyAnalyser, type ReplyAnalysis } from '@/hooks/useAI'
import { cn } from '@/lib/utils'

interface ReplyAnalyserProps {
  leadId: string
  replyText: string
  onClose: () => void
}

const SENTIMENT_CONFIG = {
  positive: { label: 'Positive', color: 'bg-green-100 text-green-700 border-green-200' },
  neutral: { label: 'Neutral', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  negative: { label: 'Negative', color: 'bg-red-100 text-red-700 border-red-200' },
  out_of_office: { label: 'Out of Office', color: 'bg-blue-100 text-blue-700 border-blue-200' },
} as const

const INTENT_CONFIG: Record<string, { label: string; color: string }> = {
  interested: { label: 'Interested', color: 'bg-green-100 text-green-700 border-green-200' },
  not_interested: { label: 'Not Interested', color: 'bg-red-100 text-red-700 border-red-200' },
  asking_for_info: { label: 'Asking for Info', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  needs_info: { label: 'Needs Info', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  wants_demo: { label: 'Wants Demo', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  meeting_request: { label: 'Meeting Request', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  unsubscribe: { label: 'Unsubscribe', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  referring_someone: { label: 'Referring Someone', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  objection: { label: 'Objection', color: 'bg-orange-100 text-orange-700 border-orange-200' },
}

export default function ReplyAnalyser({
  leadId,
  replyText,
  onClose,
}: ReplyAnalyserProps) {
  const analyser = useReplyAnalyser()
  const [text, setText] = useState(replyText)
  const [result, setResult] = useState<ReplyAnalysis | null>(null)
  const [suggestedResponse, setSuggestedResponse] = useState('')
  const [copyFeedback, setCopyFeedback] = useState(false)

  const handleAnalyse = async () => {
    if (!text.trim()) return
    try {
      const analysis = await analyser.mutateAsync({
        lead_id: leadId,
        reply_text: text,
      })
      setResult(analysis)
      setSuggestedResponse(analysis.suggested_response)
    } catch {
      // Error handled by react-query
    }
  }

  const handleCopyResponse = async () => {
    await navigator.clipboard.writeText(suggestedResponse)
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 2000)
  }

  const sentimentCfg =
    result && result.sentiment in SENTIMENT_CONFIG
      ? SENTIMENT_CONFIG[result.sentiment as keyof typeof SENTIMENT_CONFIG]
      : SENTIMENT_CONFIG.neutral
  const intentCfg =
    result && result.intent in INTENT_CONFIG
      ? INTENT_CONFIG[result.intent]
      : INTENT_CONFIG.needs_info

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Reply Analyser
              </h2>
              <p className="text-xs text-gray-500">
                AI-powered reply intelligence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Reply text input */}
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Reply Text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Paste the reply text to analyse..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>

          {/* Analyse button */}
          <button
            onClick={handleAnalyse}
            disabled={!text.trim() || analyser.isPending}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white',
              'bg-gradient-to-r from-indigo-600 to-purple-600 transition-all',
              'hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {analyser.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analysing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analyse Reply
              </>
            )}
          </button>

          {/* Error */}
          {analyser.isError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Analysis failed. Please try again.
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="mt-6 space-y-5">
              {/* Badges row */}
              <div className="flex flex-wrap gap-3">
                {/* Sentiment */}
                <div>
                  <span className="mb-1 block text-xs font-medium text-gray-500">
                    Sentiment
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium',
                      sentimentCfg.color
                    )}
                  >
                    {sentimentCfg.label}
                  </span>
                </div>

                {/* Intent */}
                <div>
                  <span className="mb-1 block text-xs font-medium text-gray-500">
                    Intent
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium',
                      intentCfg.color
                    )}
                  >
                    {intentCfg.label}
                  </span>
                </div>

                {/* Urgency */}
                <div>
                  <span className="mb-1 block text-xs font-medium text-gray-500">
                    Urgency
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium',
                      result.urgency === 'high'
                        ? 'border-red-200 bg-red-100 text-red-700'
                        : result.urgency === 'medium'
                          ? 'border-amber-200 bg-amber-100 text-amber-700'
                          : 'border-gray-200 bg-gray-100 text-gray-700'
                    )}
                  >
                    {result.urgency.charAt(0).toUpperCase() +
                      result.urgency.slice(1)}
                  </span>
                </div>
              </div>

              {/* Key Points */}
              {result.key_points && result.key_points.length > 0 && (
                <div>
                  <span className="mb-2 block text-xs font-medium text-gray-500">
                    Key Points
                  </span>
                  <ul className="space-y-1.5">
                    {result.key_points.map((point, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-gray-700"
                      >
                        <ChevronDown className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rotate-[-90deg] text-purple-400" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stage recommendation */}
              <div>
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  Stage Recommendation
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  {result.suggested_stage}
                </span>
              </div>

              {/* Confidence */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    Confidence
                  </span>
                  <span className="text-xs font-semibold text-gray-700">
                    {Math.round(result.confidence * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      result.confidence >= 0.8
                        ? 'bg-green-500'
                        : result.confidence >= 0.5
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    )}
                    style={{ width: `${result.confidence * 100}%` }}
                  />
                </div>
              </div>

              {/* Suggested response */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">
                  Suggested Response
                </label>
                <textarea
                  value={suggestedResponse}
                  onChange={(e) => setSuggestedResponse(e.target.value)}
                  rows={5}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleCopyResponse}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Copy className="h-4 w-4" />
                  {copyFeedback ? 'Copied!' : 'Copy Response'}
                </button>
                <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700">
                  <Sparkles className="h-4 w-4" />
                  Apply Stage Change
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
