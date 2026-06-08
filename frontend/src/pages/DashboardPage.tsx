import { Link } from 'react-router-dom'
import {
  Users, Zap, Target, Activity, TrendingUp, TrendingDown,
  Clock, ArrowRight, GitMerge, BarChart as BarChartIcon,
  Sparkles, ArrowUpRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts'
import { useDashboard } from '@/hooks/useAnalytics'
import { Skeleton } from '@/components/ui/skeleton'
import { SECTOR_NAMES, SECTOR_COLORS, formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ── Stage meta ────────────────────────────────────────────────────────────────
const STAGE_META: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'Awareness',     color: '#ef4444', bg: 'bg-red-50'    },
  contacted:   { label: 'Interest',      color: '#f97316', bg: 'bg-orange-50' },
  engaged:     { label: 'Consideration', color: '#eab308', bg: 'bg-yellow-50' },
  demo:        { label: 'Demo',          color: '#06b6d4', bg: 'bg-cyan-50'   },
  proposal:    { label: 'Proposal',      color: '#3b82f6', bg: 'bg-blue-50'   },
  negotiation: { label: 'Intent',        color: '#22c55e', bg: 'bg-green-50'  },
  won:         { label: 'Won',           color: '#6366f1', bg: 'bg-indigo-50' },
}

const DASHBOARD_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won']

type ActivityItem = {
  id: string; type: string; description: string
  lead_id?: string; lead_name?: string; company_name?: string; timestamp: string
}

const ACTIVITY_CONFIG: Record<string, { icon: string; bg: string; dot: string }> = {
  won:   { icon: '🏆', bg: 'bg-emerald-50', dot: 'bg-emerald-400' },
  reply: { icon: '↩️', bg: 'bg-blue-50',    dot: 'bg-blue-400'    },
  email: { icon: '✉️', bg: 'bg-amber-50',   dot: 'bg-amber-400'   },
  call:  { icon: '📞', bg: 'bg-violet-50',  dot: 'bg-violet-400'  },
}

// ── Gradient stat cards config ────────────────────────────────────────────────
const STAT_CONFIGS = [
  {
    key: 'total', title: 'Total Leads',
    icon: Users, gradient: 'from-indigo-500 to-violet-600',
    shadow: 'shadow-indigo-200', ring: 'ring-indigo-100',
    href: '/leads',
  },
  {
    key: 'hot', title: 'Hot Leads',
    icon: Zap, gradient: 'from-orange-400 to-rose-500',
    shadow: 'shadow-rose-200', ring: 'ring-rose-100',
    href: '/leads?filter=hot',
  },
  {
    key: 'campaigns', title: 'Active Campaigns',
    icon: Target, gradient: 'from-sky-500 to-cyan-500',
    shadow: 'shadow-sky-200', ring: 'ring-sky-100',
    href: '/campaigns',
  },
  {
    key: 'ai', title: 'AI Assistant',
    icon: Sparkles, gradient: 'from-violet-500 to-fuchsia-600',
    shadow: 'shadow-violet-200', ring: 'ring-violet-100',
    href: '/ai',
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: dashboard, isLoading } = useDashboard()

  const totalLeads = dashboard?.total_leads ?? 0
  const hotLeads = dashboard?.top_performing_sectors?.reduce(
    (acc, s) => acc + Math.round((s.lead_count * s.conversion_rate) / 100), 0,
  ) ?? 0

  const statValues: Record<string, string> = {
    total: formatNumber(totalLeads),
    hot: formatNumber(hotLeads),
    campaigns: '0',
    ai: 'Active',
  }
  const statTrends: Record<string, number> = { total: 12, hot: 8 }
  const statSubs: Record<string, string> = { campaigns: 'Currently running', ai: 'Ready to help' }

  const sectorData = Object.entries(dashboard?.leads_by_sector ?? {}).map(([sector, count]) => ({
    sector: SECTOR_NAMES[sector] ?? sector,
    count: count as number,
    color: SECTOR_COLORS[sector] ?? '#6366f1',
  }))

  const pipelineData = DASHBOARD_STAGES.map((stage) => ({
    stage, count: dashboard?.leads_by_stage?.[stage] ?? 0,
  }))
  const maxPipelineCount = Math.max(...pipelineData.map((s) => s.count), 1)
  const activityData: ActivityItem[] = (dashboard?.recent_activities ?? []) as ActivityItem[]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Good morning 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Here's what's happening with your pipeline today.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link to="/leads"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-white px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-all hover:shadow-sm">
            View All Leads
          </Link>
          <Link to="/campaigns"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200 hover:opacity-90 hover:-translate-y-px transition-all">
            <Sparkles className="h-3.5 w-3.5" />
            New Campaign
          </Link>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)
          : STAT_CONFIGS.map((cfg) => {
              const Icon = cfg.icon
              const trend = statTrends[cfg.key]
              return (
                <Link key={cfg.key} to={cfg.href}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl bg-white border border-border/60 p-5 card-lift',
                    'shadow-sm hover:shadow-md transition-all',
                  )}>
                  {/* Top accent bar */}
                  <div className={cn('absolute top-0 inset-x-0 h-1 bg-gradient-to-r rounded-t-2xl', cfg.gradient)} />

                  <div className="flex items-start justify-between mt-1">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                        {cfg.title}
                      </p>
                      <p className="text-3xl font-extrabold text-foreground count-up">
                        {statValues[cfg.key]}
                      </p>
                      {trend !== undefined ? (
                        <div className="flex items-center gap-1 mt-1.5">
                          {trend >= 0
                            ? <span className="inline-flex items-center gap-0.5 text-emerald-600 text-xs font-bold bg-emerald-50 rounded-full px-2 py-0.5">
                                <TrendingUp className="h-3 w-3" />+{trend}%
                              </span>
                            : <span className="inline-flex items-center gap-0.5 text-rose-600 text-xs font-bold bg-rose-50 rounded-full px-2 py-0.5">
                                <TrendingDown className="h-3 w-3" />{trend}%
                              </span>
                          }
                          <span className="text-muted-foreground text-[10px]">vs last month</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1.5">{statSubs[cfg.key]}</p>
                      )}
                    </div>

                    <div className={cn(
                      'w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-md shrink-0',
                      cfg.gradient, cfg.shadow,
                    )}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>

                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              )
            })}
      </div>

      {/* ── Chart + Activity ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Sector chart */}
        <div className="col-span-1 lg:col-span-2 rounded-2xl bg-white border border-border/60 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Leads by Sector</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Distribution across industries</p>
            </div>
            <Link to="/reports" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              Full Report <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="h-[280px]">
            {isLoading ? <Skeleton className="w-full h-full rounded-xl" />
            : sectorData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectorData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    {sectorData.map((_, i) => (
                      <linearGradient key={i} id={`bar-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={sectorData[i].color} stopOpacity={1} />
                        <stop offset="100%" stopColor={sectorData[i].color} stopOpacity={0.6} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="sector" axisLine={false} tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    dy={8} interval={0} angle={-12} textAnchor="end" height={55} />
                  <YAxis axisLine={false} tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted)/0.4)', radius: 6 }}
                    contentStyle={{
                      borderRadius: '12px', border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--card))', boxShadow: '0 8px 24px -4px rgba(0,0,0,.08)',
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [v, 'Leads']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {sectorData.map((_, i) => (
                      <Cell key={i} fill={`url(#bar-${i})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                <BarChartIcon className="w-14 h-14" />
                <p className="text-sm">No sector data yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl bg-white border border-border/60 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Recent Activity</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Latest pipeline events</p>
            </div>
            <Link to="/reports?tab=activities" className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1"><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3 w-2/3" /></div>
                </div>
              ))}
            </div>
          ) : activityData.length > 0 ? (
            <div className="space-y-1 overflow-y-auto scrollbar-thin flex-1 max-h-[270px] pr-1">
              {activityData.slice(0, 10).map((activity) => {
                const typeKey = Object.keys(ACTIVITY_CONFIG).find(k => activity.type?.includes(k)) ?? 'email'
                const cfg = ACTIVITY_CONFIG[typeKey] ?? ACTIVITY_CONFIG.email
                return (
                  <div key={activity.id}
                    className="flex gap-3 items-start p-2.5 rounded-xl hover:bg-muted/40 transition-colors cursor-default group">
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm', cfg.bg)}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
                        {activity.description}
                      </p>
                      {activity.lead_name && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {activity.lead_name}{activity.company_name && ` · ${activity.company_name}`}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(activity.timestamp).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-muted-foreground/50 gap-2">
              <Activity className="w-10 h-10" />
              <p className="text-sm">No recent activity</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Sales funnel ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-border/60 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <GitMerge className="h-4 w-4 text-primary" />
              Sales Funnel
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Lead progression through pipeline stages</p>
          </div>
          <Link to="/pipeline"
            className="inline-flex items-center gap-1 text-xs font-semibold rounded-xl border border-border/60 bg-white px-3 py-1.5 text-foreground hover:bg-muted transition-all">
            Full Pipeline <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <div className="space-y-2">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
        ) : pipelineData.some((p) => p.count > 0) ? (
          <div className="space-y-2">
            {pipelineData.map((stage, index) => {
              const meta = STAGE_META[stage.stage]
              const color = meta?.color ?? '#6366f1'
              const barFill = maxPipelineCount > 0 ? Math.max((stage.count / maxPipelineCount) * 100, 3) : 3
              const nextStage = pipelineData[index + 1]
              const convRate = nextStage && stage.count > 0
                ? Math.round((nextStage.count / stage.count) * 100) : null

              return (
                <div key={stage.stage} className="grid grid-cols-[80px_1fr_56px] sm:grid-cols-[120px_1fr_72px] items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-semibold text-muted-foreground truncate">
                      {meta?.label ?? stage.stage}
                    </span>
                  </div>
                  <div className="relative h-9 rounded-xl overflow-hidden bg-muted/30">
                    <div className="h-full rounded-xl transition-all duration-700 flex items-center justify-end pr-3"
                      style={{
                        width: `${barFill}%`,
                        background: `linear-gradient(90deg, ${color}bb, ${color})`,
                      }}>
                      {barFill > 18 && (
                        <span className="text-white text-xs font-bold">{stage.count}</span>
                      )}
                    </div>
                    {barFill <= 18 && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground">
                        {stage.count}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    {convRate !== null ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ color, backgroundColor: `${color}18` }}>
                        {convRate}% →
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
                        Won ✓
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-10 text-center text-muted-foreground/50 text-sm">No pipeline data yet.</div>
        )}
      </div>

      {/* ── Top sectors table ───────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-border/60 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">Top Performing Sectors</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Sectors with strongest conversion metrics</p>
          </div>
          <Link to="/sectors" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            All sectors <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <div className="p-5 space-y-2">
            {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : dashboard?.top_performing_sectors?.length ? (
          <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="bg-muted/30 text-muted-foreground border-b border-border/40">
                <th className="py-3 px-5 text-left text-xs font-semibold uppercase tracking-wider">Sector</th>
                <th className="py-3 px-5 text-right text-xs font-semibold uppercase tracking-wider">Leads</th>
                <th className="py-3 px-5 text-right text-xs font-semibold uppercase tracking-wider">Avg Score</th>
                <th className="py-3 px-5 text-right text-xs font-semibold uppercase tracking-wider">Hot %</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.top_performing_sectors.map((sector, i) => (
                <tr key={sector.sector_code}
                  className={cn('border-b border-border/30 hover:bg-muted/30 transition-colors', i % 2 === 0 ? '' : 'bg-muted/10')}>
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${SECTOR_COLORS[sector.sector_code] ?? '#6366f1'}18` }}>
                        <div className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: SECTOR_COLORS[sector.sector_code] ?? '#6366f1' }} />
                      </div>
                      <span className="font-semibold text-foreground">
                        {SECTOR_NAMES[sector.sector_code] ?? sector.sector_code}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-right font-semibold">{formatNumber(sector.lead_count)}</td>
                  <td className="py-3.5 px-5 text-right">
                    <span className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700">
                      {sector.avg_score.toFixed(0)}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${sector.conversion_rate}%`, backgroundColor: SECTOR_COLORS[sector.sector_code] ?? '#6366f1' }} />
                      </div>
                      <span className="text-xs font-bold text-foreground min-w-[3ch]">
                        {sector.conversion_rate.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <div className="py-14 text-center text-muted-foreground/50 text-sm">No sector data available.</div>
        )}
      </div>
    </div>
  )
}
