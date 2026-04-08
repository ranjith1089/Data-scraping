import React from 'react'
import { useAIInsights, AIInsights } from '@/hooks/useAnalytics'
import { Brain, RefreshCw, TrendingUp, AlertTriangle, Lightbulb, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIInsightCardProps {
  insights?: AIInsights
}

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  opportunity: { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
  risk: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  trend: { icon: Lightbulb, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  action: { icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
}

const IMPACT_BADGE: Record<string, string> = {
  high: 'text-red-700 bg-red-50 border-red-200',
  medium: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  low: 'text-gray-600 bg-gray-50 border-gray-200',
}

function SkeletonLoader() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 w-3/4 rounded bg-gray-200" />
      <div className="h-4 w-full rounded bg-gray-200" />
      <div className="h-4 w-5/6 rounded bg-gray-200" />
      <div className="mt-4 space-y-3">
        <div className="h-16 rounded-lg bg-gray-100" />
        <div className="h-16 rounded-lg bg-gray-100" />
      </div>
    </div>
  )
}

export default function AIInsightCard({ insights: propInsights }: AIInsightCardProps) {
  const { data: fetchedInsights, isLoading, refetch, isFetching } = useAIInsights()

  const insights = propInsights || fetchedInsights

  return (
    <div className="rounded-xl border border-gray-200 border-l-4 border-l-purple-500 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-purple-50 p-2">
            <Brain className="h-4.5 w-4.5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">AI Analysis</h3>
            {insights?.generated_at && (
              <p className="text-[11px] text-gray-400">
                Updated{' '}
                {new Date(insights.generated_at).toLocaleString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          title="Refresh insights"
        >
          <RefreshCw
            className={cn('h-4 w-4', isFetching && 'animate-spin')}
          />
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {isLoading ? (
          <SkeletonLoader />
        ) : !insights ? (
          <div className="py-8 text-center">
            <Brain className="mx-auto h-8 w-8 text-gray-200" />
            <p className="mt-2 text-sm text-gray-400">
              No AI insights available yet
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Summary */}
            <p className="text-sm leading-relaxed text-gray-700">
              {insights.summary}
            </p>

            {/* Key Insights */}
            {insights.key_insights.length > 0 && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Key Insights
                </h4>
                {insights.key_insights.map((insight, idx) => {
                  const cfg =
                    CATEGORY_CONFIG[insight.category] || CATEGORY_CONFIG.trend
                  const CatIcon = cfg.icon
                  return (
                    <div
                      key={idx}
                      className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3"
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md',
                          cfg.bg
                        )}
                      >
                        <CatIcon className={cn('h-3.5 w-3.5', cfg.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {insight.title}
                          </p>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize',
                              IMPACT_BADGE[insight.impact] || IMPACT_BADGE.low
                            )}
                          >
                            {insight.impact}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Recommended Actions */}
            {insights.recommended_actions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Recommended Actions
                </h4>
                <ul className="space-y-1.5">
                  {insights.recommended_actions.map((action, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <span
                        className={cn(
                          'mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full',
                          action.priority === 'high'
                            ? 'bg-red-500'
                            : action.priority === 'medium'
                              ? 'bg-yellow-500'
                              : 'bg-gray-400'
                        )}
                      />
                      <span>
                        {action.action}
                        {action.target_leads > 0 && (
                          <span className="ml-1 text-xs text-gray-400">
                            ({action.target_leads} leads)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
