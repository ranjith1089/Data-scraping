import { RefreshCw, Brain } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn, timeAgo } from '@/lib/utils'

interface AIInsight {
  insight: string
  generated_at: string
}

// Backend returns { ai_insights: string } (see backend/routers/analytics.py
// get_ai_insights). We normalize into the shape this banner uses.
interface RawInsightResponse {
  ai_insights?: string
  insight?: string
  generated_at?: string
}

function useAIInsights() {
  return useQuery({
    queryKey: ['ai-insights'],
    queryFn: async () => {
      const { data } = await api.get<RawInsightResponse>('/analytics/ai-insights')
      const insight = data?.insight ?? data?.ai_insights ?? ''
      return {
        insight,
        generated_at: data?.generated_at ?? new Date().toISOString(),
      } as AIInsight
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export default function AIInsightBanner() {
  const { data, isLoading, isFetching, refetch } = useAIInsights()

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Animated gradient border effect */}
      <div
        className={cn(
          'absolute inset-0 rounded-xl',
          (isLoading || isFetching) && 'animate-pulse-border'
        )}
        style={{
          background:
            isLoading || isFetching
              ? 'linear-gradient(90deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15), rgba(99,102,241,0.15))'
              : 'transparent',
          backgroundSize: '200% 100%',
        }}
      />

      <div className="relative flex items-start gap-4 px-5 py-4">
        {/* Icon */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
          <Brain className="h-5 w-5 text-white" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              AI Insights
            </h3>
            {data?.generated_at && (
              <span className="text-xs text-gray-400">
                Last updated: {timeAgo(data.generated_at)}
              </span>
            )}
          </div>

          {isLoading ? (
            <InsightSkeleton />
          ) : data?.insight ? (
            <p className="text-sm leading-relaxed text-gray-600">
              {data.insight}
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              No insights available. Click refresh to generate.
            </p>
          )}
        </div>

        {/* Refresh button */}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex-shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
          title="Refresh insights"
        >
          <RefreshCw
            className={cn('h-4 w-4', isFetching && 'animate-spin')}
          />
        </button>
      </div>

      {/* Subtle gradient bottom accent */}
      <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-60" />
    </div>
  )
}

function InsightSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-3.5 w-full animate-pulse rounded bg-gray-100" />
      <div className="h-3.5 w-4/5 animate-pulse rounded bg-gray-100" />
      <div className="h-3.5 w-3/5 animate-pulse rounded bg-gray-100" />
    </div>
  )
}
