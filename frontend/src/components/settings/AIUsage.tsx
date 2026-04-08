import React from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn, formatNumber } from '@/lib/utils'
import {
  Cpu,
  Loader2,
  Zap,
  MessageSquare,
  Mail,
  Target,
  Brain,
  ArrowUpRight,
} from 'lucide-react'

interface AIUsageData {
  total_calls: number
  call_limit: number
  tokens_used: number
  remaining_calls: number
  plan_name: string
  breakdown: {
    email_gen: number
    lead_score: number
    chat: number
    insight: number
  }
}

const USAGE_TYPES: {
  key: keyof AIUsageData['breakdown']
  label: string
  icon: React.ElementType
  color: string
}[] = [
  { key: 'email_gen', label: 'Email Generation', icon: Mail, color: 'bg-blue-500' },
  { key: 'lead_score', label: 'Lead Scoring', icon: Target, color: 'bg-green-500' },
  { key: 'chat', label: 'AI Chat', icon: MessageSquare, color: 'bg-purple-500' },
  { key: 'insight', label: 'Insights', icon: Brain, color: 'bg-amber-500' },
]

function CircularProgress({
  used,
  limit,
}: {
  used: number
  limit: number
}) {
  const pct = limit > 0 ? (used / limit) * 100 : 0
  const clampedPct = Math.min(pct, 100)
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clampedPct / 100) * circumference

  const strokeColor =
    pct > 80 ? '#EF4444' : pct > 50 ? '#F59E0B' : '#22C55E'

  return (
    <div className="relative flex items-center justify-center">
      <svg width="148" height="148" className="-rotate-90">
        <circle
          cx="74"
          cy="74"
          r={radius}
          fill="none"
          stroke="#F3F4F6"
          strokeWidth="10"
        />
        <circle
          cx="74"
          cy="74"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-bold text-gray-900">
          {pct.toFixed(0)}%
        </p>
        <p className="text-[11px] text-gray-500">used</p>
      </div>
    </div>
  )
}

export default function AIUsage() {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: async () => {
      const { data } = await api.get<{ ai_usage: AIUsageData }>(
        '/analytics/dashboard'
      )
      return data.ai_usage
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <Cpu className="mx-auto h-8 w-8 text-gray-200" />
        <p className="mt-2 text-sm text-gray-400">
          AI usage data unavailable
        </p>
      </div>
    )
  }

  const usagePct = data.call_limit > 0 ? (data.total_calls / data.call_limit) * 100 : 0
  const maxBreakdown = Math.max(
    data.breakdown.email_gen,
    data.breakdown.lead_score,
    data.breakdown.chat,
    data.breakdown.insight,
    1
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Cpu className="h-5 w-5 text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900">AI Usage</h2>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
            data.plan_name === 'enterprise'
              ? 'bg-purple-50 text-purple-700'
              : data.plan_name === 'pro'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-gray-100 text-gray-700'
          )}
        >
          {data.plan_name.charAt(0).toUpperCase() + data.plan_name.slice(1)} Plan
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Circular Progress */}
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6">
          <CircularProgress used={data.total_calls} limit={data.call_limit} />
          <p className="mt-4 text-sm font-medium text-gray-700">
            {formatNumber(data.total_calls)}{' '}
            <span className="text-gray-400">/ {formatNumber(data.call_limit)}</span>
          </p>
          <p className="text-xs text-gray-500">API calls this month</p>
        </div>

        {/* Stats */}
        <div className="space-y-3 lg:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 inline-flex rounded-lg bg-blue-50 p-2">
                <Zap className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-lg font-bold text-gray-900">
                {formatNumber(data.total_calls)}
              </p>
              <p className="text-xs text-gray-500">Total Calls</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 inline-flex rounded-lg bg-purple-50 p-2">
                <Cpu className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-lg font-bold text-gray-900">
                {data.tokens_used >= 1_000_000
                  ? `${(data.tokens_used / 1_000_000).toFixed(1)}M`
                  : data.tokens_used >= 1_000
                    ? `${(data.tokens_used / 1_000).toFixed(1)}K`
                    : formatNumber(data.tokens_used)}
              </p>
              <p className="text-xs text-gray-500">Tokens Used</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 inline-flex rounded-lg bg-green-50 p-2">
                <Target className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-lg font-bold text-gray-900">
                {formatNumber(data.remaining_calls)}
              </p>
              <p className="text-xs text-gray-500">Remaining</p>
            </div>
          </div>

          {/* Breakdown by Type */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Usage Breakdown
            </h3>
            <div className="space-y-3">
              {USAGE_TYPES.map(({ key, label, icon: TypeIcon, color }) => {
                const count = data.breakdown[key]
                const barPct = (count / maxBreakdown) * 100
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-opacity-10',
                        color
                      )}
                    >
                      <TypeIcon
                        className={cn(
                          'h-3.5 w-3.5',
                          color.replace('bg-', 'text-')
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">
                          {label}
                        </span>
                        <span className="text-xs font-semibold text-gray-900">
                          {formatNumber(count)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            color
                          )}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade CTA */}
      {usagePct > 80 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Running low on AI calls
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              You have used {usagePct.toFixed(0)}% of your monthly AI quota.
              Upgrade your plan to unlock more capacity.
            </p>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700">
            Upgrade Plan
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
