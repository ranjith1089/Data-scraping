import {
  Send,
  CheckCircle2,
  Eye,
  MousePointerClick,
  MessageSquare,
  AlertTriangle,
  Loader2,
  TrendingUp,
} from 'lucide-react'
import { useCampaignStats } from '@/hooks/useCampaigns'
import { cn, formatNumber } from '@/lib/utils'

interface CampaignStatsProps {
  campaignId: string
}

interface StatCardData {
  label: string
  value: number
  icon: React.ElementType
  color: string
  bgColor: string
}

export default function CampaignStats({ campaignId }: CampaignStatsProps) {
  const { data: stats, isLoading } = useCampaignStats(campaignId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="py-12 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm text-gray-500">No stats available yet</p>
      </div>
    )
  }

  const cards: StatCardData[] = [
    { label: 'Sent', value: stats.sent, icon: Send, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Delivered', value: Math.max(stats.sent - stats.failed, 0), icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50' },
    { label: 'Opened', value: stats.opened, icon: Eye, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { label: 'Clicked', value: stats.clicked, icon: MousePointerClick, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { label: 'Replied', value: stats.replied, icon: MessageSquare, color: 'text-teal-600', bgColor: 'bg-teal-50' },
    { label: 'Failed', value: stats.failed, icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50' },
  ]

  const rates = [
    { label: 'Open Rate', value: stats.open_rate, color: 'bg-purple-500' },
    { label: 'Click Rate', value: stats.click_rate, color: 'bg-orange-500' },
    { label: 'Reply Rate', value: stats.reply_rate, color: 'bg-teal-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className={cn('mb-3 inline-flex rounded-lg p-2', card.bgColor)}>
              <card.icon className={cn('h-4 w-4', card.color)} />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(card.value)}
            </p>
            <p className="text-xs font-medium text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Rate Bars */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <TrendingUp className="h-4 w-4 text-gray-400" />
          Performance Rates
        </h3>
        <div className="space-y-4">
          {rates.map((rate) => (
            <div key={rate.label}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{rate.label}</span>
                <span className="text-sm font-bold text-gray-900">
                  {rate.value.toFixed(1)}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', rate.color)}
                  style={{ width: `${Math.min(rate.value, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step-by-Step Breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900">Step-by-Step Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Step</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Sent</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Opened</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Clicked</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Replied</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Open Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {/* Show overall as single row when no per-step data */}
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-3">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-900">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                      1
                    </span>
                    All Steps
                  </span>
                </td>
                <td className="px-6 py-3 text-right text-sm text-gray-700">
                  {formatNumber(stats.sent)}
                </td>
                <td className="px-6 py-3 text-right text-sm text-gray-700">
                  {formatNumber(stats.opened)}
                </td>
                <td className="px-6 py-3 text-right text-sm text-gray-700">
                  {formatNumber(stats.clicked)}
                </td>
                <td className="px-6 py-3 text-right text-sm text-gray-700">
                  {formatNumber(stats.replied)}
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-purple-500"
                        style={{ width: `${stats.open_rate}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {stats.open_rate.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
