import {
  RefreshCw,
  BarChart3,
  Sparkles,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useSectorBrief } from '@/hooks/useAI'
import { cn, SECTOR_COLORS, SECTOR_NAMES } from '@/lib/utils'

interface SectorBriefCardProps {
  sectorCode: string
}

export default function SectorBriefCard({ sectorCode }: SectorBriefCardProps) {
  const {
    data: brief,
    isLoading,
    isFetching,
    refetch,
  } = useSectorBrief(sectorCode)

  const sectorColor = SECTOR_COLORS[sectorCode] || '#6B7280'
  const sectorName = SECTOR_NAMES[sectorCode] || sectorCode

  if (isLoading) {
    return <SectorBriefSkeleton sectorColor={sectorColor} />
  }

  if (!brief) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">
          No brief available for this sector.
        </p>
        <button
          onClick={() => refetch()}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Generate Brief
        </button>
      </div>
    )
  }

  const markdownContent = [
    brief.summary,
    '',
    '## Key Trends',
    ...brief.key_trends.map((t) => `- ${t}`),
    '',
    '## Opportunities',
    ...brief.opportunities.map((o) => `- ${o}`),
    '',
    '## Challenges',
    ...brief.challenges.map((c) => `- ${c}`),
    '',
    '## Recommended Approach',
    brief.recommended_approach,
    '',
    brief.top_companies.length > 0
      ? `**Top Companies:** ${brief.top_companies.join(', ')}`
      : '',
    '',
    brief.market_size_estimate
      ? `**Market Size:** ${brief.market_size_estimate} | **Growth:** ${brief.growth_rate}`
      : '',
  ].join('\n')

  return (
    <div
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      style={{ borderTopWidth: '3px', borderTopColor: sectorColor }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${sectorColor}15` }}
          >
            <BarChart3
              className="h-5 w-5"
              style={{ color: sectorColor }}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {sectorName}
            </h3>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Sparkles className="h-3 w-3 text-purple-400" />
              AI Intelligence Brief
            </div>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
          title="Refresh brief"
        >
          <RefreshCw
            className={cn('h-4 w-4', isFetching && 'animate-spin')}
          />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <div className="prose prose-sm max-w-none prose-headings:text-sm prose-headings:font-semibold prose-headings:text-gray-900 prose-p:text-gray-600 prose-li:text-gray-600 prose-strong:text-gray-800 prose-ul:my-1 prose-li:my-0.5">
          <ReactMarkdown>{markdownContent}</ReactMarkdown>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-3">
        <span className="text-xs text-gray-400">
          Generated at:{' '}
          {brief.generated_at
            ? new Date(brief.generated_at).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : 'N/A'}
        </span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-40"
        >
          <RefreshCw
            className={cn('h-3 w-3', isFetching && 'animate-spin')}
          />
          Refresh
        </button>
      </div>
    </div>
  )
}

function SectorBriefSkeleton({ sectorColor }: { sectorColor: string }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      style={{ borderTopWidth: '3px', borderTopColor: sectorColor }}
    >
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-100" />
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
      <div className="space-y-3 px-5 py-4">
        <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-4/6 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-3 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-3 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-3">
        <div className="h-3 w-40 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  )
}
