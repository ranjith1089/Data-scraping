import { Link } from 'react-router-dom'
import {
  Activity,
  Target,
  Users,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowRight,
  GitMerge,
  BarChart as BarChartIcon,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts'
import { useDashboard } from '@/hooks/useAnalytics'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { SECTOR_NAMES, SECTOR_COLORS, formatNumber } from '@/lib/utils'

// Pipeline stage metadata (matches reference colors exactly)
const STAGE_META: Record<string, { label: string; color: string }> = {
  new: { label: 'Awareness', color: '#ef4444' },
  contacted: { label: 'Interest', color: '#f97316' },
  engaged: { label: 'Consideration', color: '#eab308' },
  demo: { label: 'Demo', color: '#06b6d4' },
  proposal: { label: 'Proposal', color: '#3b82f6' },
  negotiation: { label: 'Intent', color: '#22c55e' },
  won: { label: 'Won', color: '#6366f1' },
  lost: { label: 'Lost', color: '#94a3b8' },
}

// Must mirror backend/schemas/lead.py::LeadStage. See STAGE_LABELS.
const DASHBOARD_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won']

type ActivityItem = {
  id: string
  type: string
  description: string
  lead_id?: string
  lead_name?: string
  company_name?: string
  timestamp: string
}

export default function DashboardPage() {
  const { data: dashboard, isLoading } = useDashboard()

  const totalLeads = dashboard?.total_leads ?? 0
  const hotLeads = dashboard?.top_performing_sectors?.reduce(
    (acc, s) => acc + Math.round((s.lead_count * s.conversion_rate) / 100),
    0,
  ) ?? 0
  const activeCampaigns = 0 // placeholder — backend doesn't expose this on dashboard
  const aiCallsLeft = 0 // populated by a separate endpoint; show 0 if not available

  // Build sector chart data from dashboard.leads_by_sector
  const sectorData = Object.entries(dashboard?.leads_by_sector ?? {}).map(
    ([sector, count]) => ({
      sector: SECTOR_NAMES[sector] ?? sector,
      count: count as number,
      color: SECTOR_COLORS[sector] ?? '#3B82F6',
    }),
  )

  // Build pipeline data — use full stage list from dashboard.leads_by_stage
  const pipelineData = DASHBOARD_STAGES.map((stage) => ({
    stage,
    count: dashboard?.leads_by_stage?.[stage] ?? 0,
  }))
  const maxPipelineCount = Math.max(...pipelineData.map((s) => s.count), 1)

  const activityData: ActivityItem[] = (dashboard?.recent_activities ?? []) as ActivityItem[]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your lead generation performance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link to="/leads">View All Leads</Link>
          </Button>
          <Button asChild>
            <Link to="/campaigns">New Campaign</Link>
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array(4)
            .fill(0)
            .map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : (
          <>
            <StatCard
              title="Total Leads"
              value={formatNumber(totalLeads)}
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              trend={12}
              trendLabel="from last month"
            />
            <StatCard
              title="Hot Leads"
              value={formatNumber(hotLeads)}
              icon={<Zap className="h-4 w-4 text-orange-500" />}
              trend={8}
              trendLabel="from last month"
            />
            <StatCard
              title="Active Campaigns"
              value={String(activeCampaigns)}
              icon={<Target className="h-4 w-4 text-primary" />}
              subtitle="Currently running"
            />
            <StatCard
              title="AI Calls Left"
              value={formatNumber(aiCallsLeft)}
              icon={<Activity className="h-4 w-4 text-violet-500" />}
              subtitle="Resets in 12 days"
            />
          </>
        )}
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Leads by Sector</CardTitle>
            <CardDescription>
              Distribution of your leads across different industries
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : sectorData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sectorData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="sector"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    dy={10}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--card))',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {sectorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                <BarChartIcon className="w-12 h-12 mb-2 opacity-20" />
                <p>No sector data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest events from your pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
              </div>
            ) : activityData.length > 0 ? (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                {activityData.slice(0, 10).map((activity) => {
                  const isWon = activity.type?.includes('won') || activity.type === 'lead_won'
                  const isReply = activity.type?.includes('reply')
                  const isOpen = activity.type?.includes('open') || activity.type?.includes('email')

                  return (
                    <div key={activity.id} className="flex gap-3 items-start">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isWon
                            ? 'bg-emerald-100 text-emerald-600'
                            : isReply
                              ? 'bg-blue-100 text-blue-600'
                              : isOpen
                                ? 'bg-amber-100 text-amber-600'
                                : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isWon ? (
                          <Target className="w-4 h-4" />
                        ) : isReply ? (
                          <ArrowRight className="w-4 h-4" />
                        ) : (
                          <Activity className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {activity.description}
                        </p>
                        {activity.lead_name && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {activity.lead_name}
                            {activity.company_name && ` at ${activity.company_name}`}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(activity.timestamp).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No recent activity.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sales Funnel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-primary" />
              Sales Funnel
            </CardTitle>
            <CardDescription className="mt-1">
              Lead progression through each pipeline stage
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/pipeline">View Full Pipeline</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array(7)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
                ))}
            </div>
          ) : pipelineData.some((p) => p.count > 0) ? (
            <div className="space-y-1.5">
              {pipelineData.map((stage, index) => {
                const meta = STAGE_META[stage.stage]
                const color = meta?.color ?? '#6366f1'
                const barFill =
                  maxPipelineCount > 0
                    ? Math.max((stage.count / maxPipelineCount) * 100, 4)
                    : 4
                const nextStage = pipelineData[index + 1]
                const convRate =
                  nextStage && stage.count > 0
                    ? Math.round((nextStage.count / stage.count) * 100)
                    : null

                return (
                  <div
                    key={stage.stage}
                    className="grid grid-cols-[112px_1fr_64px] items-center gap-3"
                  >
                    <div className="flex items-center gap-1.5 justify-end">
                      <div
                        className="w-2 h-2 rounded-sm shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        {meta?.label ?? stage.stage}
                      </span>
                    </div>
                    <div className="relative h-8 rounded overflow-hidden bg-muted/30">
                      <div
                        className="h-full rounded transition-all duration-700 flex items-center justify-end pr-2.5"
                        style={{ width: `${barFill}%`, backgroundColor: color }}
                      >
                        {barFill > 20 && (
                          <span className="text-white text-xs font-bold">
                            {stage.count}
                          </span>
                        )}
                      </div>
                      {barFill <= 20 && (
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground">
                          {stage.count}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      {convRate !== null ? (
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color }}
                        >
                          {convRate}%→
                        </span>
                      ) : (
                        <Badge className="text-[10px] px-1.5 font-medium bg-indigo-500 hover:bg-indigo-500 text-white">
                          Won
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground text-sm">
              No pipeline data available.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top performing sectors table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Sectors</CardTitle>
          <CardDescription>
            Sectors with the strongest lead conversion metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : dashboard?.top_performing_sectors && dashboard.top_performing_sectors.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-3 font-medium">Sector</th>
                    <th className="pb-3 font-medium text-right">Leads</th>
                    <th className="pb-3 font-medium text-right">Avg Score</th>
                    <th className="pb-3 font-medium text-right">Hot %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dashboard.top_performing_sectors.map((sector) => (
                    <tr
                      key={sector.sector_code}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                SECTOR_COLORS[sector.sector_code] ?? '#3B82F6',
                            }}
                          />
                          <span className="font-medium text-foreground">
                            {SECTOR_NAMES[sector.sector_code] ?? sector.sector_code}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        {formatNumber(sector.lead_count)}
                      </td>
                      <td className="py-3 text-right">
                        {sector.avg_score.toFixed(0)}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span>{sector.conversion_rate.toFixed(0)}%</span>
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${sector.conversion_rate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No sector data available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  trend,
  trendLabel,
  subtitle,
}: {
  title: string
  value: string
  icon: React.ReactNode
  trend?: number
  trendLabel?: string
  subtitle?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {trend !== undefined ? (
          <div className="flex items-center text-xs mt-1">
            {trend >= 0 ? (
              <span className="text-emerald-500 flex items-center font-medium">
                <TrendingUp className="h-3 w-3 mr-1" />+{trend}%
              </span>
            ) : (
              <span className="text-rose-500 flex items-center font-medium">
                <TrendingDown className="h-3 w-3 mr-1" />
                {trend}%
              </span>
            )}
            {trendLabel && (
              <span className="text-muted-foreground ml-2">{trendLabel}</span>
            )}
          </div>
        ) : (
          subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )
        )}
      </CardContent>
    </Card>
  )
}
