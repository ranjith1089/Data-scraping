import {
  Users,
  Flame,
  Send,
  TrendingUp,
  Bot,
  RefreshCw,
  Activity,
  Mail,
  PhoneCall,
  Calendar,
  FileText,
  UserPlus,
  Star,
} from 'lucide-react'
import { useDashboard } from '@/hooks/useAnalytics'
import AIInsightBanner from '@/components/ai/AIInsightBanner'
import MetricCard from '@/components/analytics/MetricCard'
import SectorBarChart from '@/components/analytics/SectorBarChart'
import FunnelChart from '@/components/analytics/FunnelChart'
import CampaignTable from '@/components/analytics/CampaignTable'
import { cn, SECTOR_NAMES, formatNumber, timeAgo } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  call: PhoneCall,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  lead_created: UserPlus,
  score_updated: Star,
}

export default function DashboardPage() {
  const { data, isLoading, isFetching } = useDashboard()
  const queryClient = useQueryClient()

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['ai-insights'] })
  }

  if (isLoading) {
    return <DashboardSkeleton />
  }

  // NOTE: every field on `data` is defensively guarded. The backend shape
  // is normalized in useDashboard(), but a future schema drift or a partial
  // payload should NEVER hard-crash the dashboard render. Previously a
  // missing `leads_by_stage` caused `Object.entries(undefined)` to throw
  // "Cannot convert undefined or null to object" and white-screen the page.
  const leadsByStage = data?.leads_by_stage ?? {}
  const leadsBySector = data?.leads_by_sector ?? {}
  const topSectors = data?.top_performing_sectors ?? []
  const recentActivities = data?.recent_activities ?? []

  const hotLeads = Object.entries(leadsByStage).reduce((sum, [stage, count]) => {
    if (stage === 'demo' || stage === 'proposal' || stage === 'negotiation') {
      return sum + (Number(count) || 0)
    }
    return sum
  }, 0)

  const activeCampaigns = 0 // Will be populated from API

  const sectorChartData = Object.entries(leadsBySector).map(([sector, count]) => {
    const topSector = topSectors.find((s) => s.sector_code === sector)
    const safeCount = Number(count) || 0
    return {
      sector,
      sector_name: SECTOR_NAMES[sector] || sector,
      count: safeCount,
      hot_count: topSector ? Math.round(safeCount * (topSector.conversion_rate / 100)) : 0,
      avg_score: topSector?.avg_score || 0,
    }
  })

  const funnelData = {
    awareness: leadsByStage['new'] || 0,
    interest: leadsByStage['contacted'] || 0,
    consideration: leadsByStage['engaged'] || leadsByStage['qualified'] || 0,
    intent: leadsByStage['demo'] || 0,
    demo: leadsByStage['proposal'] || 0,
    proposal: leadsByStage['negotiation'] || 0,
    won: leadsByStage['won'] || 0,
  }

  const campaignTableData = topSectors.slice(0, 5).map((s) => ({
    name: SECTOR_NAMES[s.sector_code] || s.sector_code,
    sent: s.lead_count,
    opened: Math.round(s.lead_count * 0.6),
    replied: Math.round(s.lead_count * 0.2),
    open_rate: s.conversion_rate,
  }))

  return (
    <div className="space-y-6">
      {/* AI Insight Banner */}
      <AIInsightBanner />

      {/* Refresh Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Total Leads"
          value={formatNumber(data?.total_leads || 0)}
          icon={Users}
          color="bg-blue-500"
          change={data?.new_leads_this_week ? Math.round((data.new_leads_this_week / Math.max(data.total_leads, 1)) * 100) : undefined}
        />
        <MetricCard
          title="Hot Leads"
          value={formatNumber(hotLeads)}
          icon={Flame}
          color="bg-red-500"
        />
        <MetricCard
          title="Active Campaigns"
          value={formatNumber(activeCampaigns)}
          icon={Send}
          color="bg-green-500"
        />
        <MetricCard
          title="Leads This Week"
          value={formatNumber(data?.new_leads_this_week || 0)}
          icon={TrendingUp}
          color="bg-purple-500"
        />
        <MetricCard
          title="AI Calls Left"
          value="-"
          icon={Bot}
          color="bg-amber-500"
        />
      </div>

      {/* Two-Column Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column: Charts */}
        <div className="space-y-6">
          <SectorBarChart data={sectorChartData} />
          <FunnelChart data={funnelData} />
        </div>

        {/* Right Column: Campaign Table + Activity Feed */}
        <div className="space-y-6">
          <CampaignTable data={campaignTableData} />

          {/* Recent Activity Feed */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Activity className="h-4 w-4 text-gray-400" />
                Recent Activity
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {recentActivities.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Activity className="mx-auto h-8 w-8 text-gray-200" />
                  <p className="mt-2 text-sm text-gray-400">No recent activity</p>
                </div>
              ) : (
                recentActivities.slice(0, 10).map((activity) => {
                  const Icon = ACTIVITY_ICONS[activity.type] || Activity
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 px-6 py-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50">
                        <Icon className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-700">{activity.description}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                          <span>{activity.lead_name}</span>
                          <span>-</span>
                          <span>{timeAgo(activity.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* AI Banner skeleton */}
      <div className="h-24 animate-pulse rounded-xl bg-gray-100" />

      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-200" />
      </div>

      {/* Metric Cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>

      {/* Two-column skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="h-96 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-80 animate-pulse rounded-xl bg-gray-100" />
        </div>
        <div className="space-y-6">
          <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-96 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    </div>
  )
}
