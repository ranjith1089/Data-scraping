import { useState } from 'react'
import {
  AreaChart, Area,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  Users,
  IndianRupee,
  MessageSquare,
  Activity,
  Trophy,
  Mail,
  Linkedin,
  MessageCircle,
  PhoneCall,
  Calendar,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import {
  useLeadReport,
  useRevenueReport,
  useOutreachReport,
  useActivitiesReport,
} from '@/hooks/useReports'
import { cn, formatINR, SECTOR_NAMES, STAGE_LABELS, STAGE_COLORS } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

function fmtDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function fmtWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function pct(num: number, den: number) {
  return den === 0 ? 0 : Math.round((num / den) * 100)
}

// ─── Small reusable bits ──────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, color = 'bg-white border-border/60',
}: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; color?: string
}) {
  return (
    <div className={cn('rounded-2xl border p-4 shadow-sm relative overflow-hidden card-lift', color)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-extrabold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-foreground mb-3">{children}</h3>
}

const CHART_COLORS = {
  indigo:  '#6366f1',
  green:   '#22c55e',
  amber:   '#f59e0b',
  sky:     '#0ea5e9',
  rose:    '#f43f5e',
  purple:  '#a855f7',
  teal:    '#14b8a6',
  orange:  '#f97316',
}

const PIE_PALETTE = [
  CHART_COLORS.indigo, CHART_COLORS.sky, CHART_COLORS.green,
  CHART_COLORS.amber, CHART_COLORS.rose, CHART_COLORS.purple,
  CHART_COLORS.teal, CHART_COLORS.orange,
]

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'leads' | 'revenue' | 'outreach' | 'activities'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'leads',      label: 'Leads',      icon: <Users      className="w-4 h-4" /> },
  { key: 'revenue',    label: 'Revenue',    icon: <IndianRupee className="w-4 h-4" /> },
  { key: 'outreach',   label: 'Outreach',   icon: <MessageSquare className="w-4 h-4" /> },
  { key: 'activities', label: 'Activities', icon: <Activity   className="w-4 h-4" /> },
]

// ─── Leads tab ────────────────────────────────────────────────────────────────

function LeadsTab() {
  const [days, setDays] = useState<30 | 60 | 90>(90)
  const { data, isLoading, isError, refetch } = useLeadReport(days)

  if (isLoading) return <TabSkeleton />
  if (isError || !data) return <ErrorState onRetry={refetch} />

  const sectorData = data.by_sector.map((s) => ({
    name: SECTOR_NAMES[s.sector] ?? s.sector,
    count: s.count,
  }))

  const stageData = data.by_stage.map((s) => ({
    name: STAGE_LABELS[s.stage] ?? s.stage,
    count: s.count,
    fill: STAGE_COLORS[s.stage] ?? '#6B7280',
  }))

  const growthData = data.growth.map((g) => ({ ...g, label: fmtDay(g.date) }))

  return (
    <div className="space-y-6">
      {/* Totals strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Leads" value={data.totals.total}
          icon={<Users className="w-4 h-4 text-indigo-400" />}
          color="border-indigo-200 bg-indigo-50/40" />
        <StatCard label="Have Email" value={data.totals.with_email}
          sub={`${pct(data.totals.with_email, data.totals.total)}% of leads`}
          icon={<Mail className="w-4 h-4 text-sky-400" />}
          color="border-sky-200 bg-sky-50/40" />
        <StatCard label="Have Phone" value={data.totals.with_phone}
          sub={`${pct(data.totals.with_phone, data.totals.total)}% of leads`}
          icon={<PhoneCall className="w-4 h-4 text-green-400" />}
          color="border-green-200 bg-green-50/40" />
        <StatCard label="Enriched" value={data.totals.enriched}
          sub={`${pct(data.totals.enriched, data.totals.total)}% of leads`}
          icon={<TrendingUp className="w-4 h-4 text-purple-400" />}
          color="border-purple-200 bg-purple-50/40" />
        <StatCard label="Hot Leads (≥80)" value={data.totals.hot}
          sub={`${pct(data.totals.hot, data.totals.total)}% of leads`}
          icon={<Trophy className="w-4 h-4 text-amber-400" />}
          color="border-amber-200 bg-amber-50/40" />
      </div>

      {/* Range picker + growth chart */}
      <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Lead Growth</SectionTitle>
          <div className="flex gap-1">
            {([30, 60, 90] as const).map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
                  days === d ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white' : 'text-muted-foreground hover:bg-muted'
                )}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        {growthData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No leads in this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={growthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.indigo} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.indigo} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => [v, 'New leads']} />
              <Area type="monotone" dataKey="count" stroke={CHART_COLORS.indigo} fill="url(#leadGradient)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Sector + Stage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
          <SectionTitle>Leads by Sector</SectionTitle>
          {sectorData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No sector data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sectorData} layout="vertical" margin={{ top: 0, right: 10, left: 80, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={76} />
                <Tooltip formatter={(v: number) => [v, 'Leads']} />
                <Bar dataKey="count" fill={CHART_COLORS.indigo} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
          <SectionTitle>Leads by Stage</SectionTitle>
          {stageData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No stage data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [v, 'Leads']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stageData.map((s, i) => (
                    <Cell key={i} fill={s.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Score distribution + ICP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
          <SectionTitle>Lead Score Distribution</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.by_score} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => [v, 'Leads']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.by_score.map((_, i) => {
                  const colors = [CHART_COLORS.sky, CHART_COLORS.teal, CHART_COLORS.amber, CHART_COLORS.orange, CHART_COLORS.rose]
                  return <Cell key={i} fill={colors[i % colors.length]} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
          <SectionTitle>ICP Fit Breakdown</SectionTitle>
          {data.by_icp.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No ICP data yet — score some leads first.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={data.by_icp} dataKey="count" nameKey="icp_fit" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                    {data.by_icp.map((_, i) => <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, 'Leads']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {data.by_icp.map((d, i) => (
                  <div key={d.icp_fit} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: PIE_PALETTE[i % PIE_PALETTE.length] }} />
                    <span className="text-xs capitalize text-gray-700">{d.icp_fit}</span>
                    <span className="text-xs font-medium text-gray-900 ml-auto">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Revenue tab ──────────────────────────────────────────────────────────────

function RevenueTab() {
  const [months, setMonths] = useState<6 | 12>(12)
  const { data, isLoading, isError, refetch } = useRevenueReport(months)

  if (isLoading) return <TabSkeleton />
  if (isError || !data) return <ErrorState onRetry={refetch} />

  const monthlyData = data.monthly_won.map((m) => ({
    ...m,
    label: fmtMonth(m.month),
  }))

  const wlData = data.win_loss_trend.map((m) => ({
    ...m,
    label: fmtMonth(m.month),
  }))

  const totalWon = data.monthly_won.reduce((a, m) => a + m.revenue, 0)
  const totalWonCount = data.monthly_won.reduce((a, m) => a + m.count, 0)
  const winRate = data.status_counts.won + data.status_counts.lost > 0
    ? Math.round(data.status_counts.won / (data.status_counts.won + data.status_counts.lost) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Pipeline" value={formatINR(data.pipeline_by_stage.reduce((a, s) => a + s.total_value, 0))}
          sub={`${data.status_counts.open} open deals`}
          icon={<TrendingUp className="w-4 h-4 text-indigo-400" />}
          color="border-indigo-200 bg-indigo-50/40" />
        <StatCard label={`Won (${months}mo window)`} value={formatINR(totalWon)}
          sub={`${totalWonCount} deal${totalWonCount !== 1 ? 's' : ''}`}
          icon={<Trophy className="w-4 h-4 text-green-500" />}
          color="border-green-200 bg-green-50/40" />
        <StatCard label="Win Rate" value={`${winRate}%`}
          sub={`${data.status_counts.won} won · ${data.status_counts.lost} lost`}
          icon={<TrendingUp className="w-4 h-4 text-sky-400" />}
          color="border-sky-200 bg-sky-50/40" />
        <StatCard label="Avg Deal Size" value={formatINR(data.avg_deal_size)}
          sub="won deals only"
          icon={<IndianRupee className="w-4 h-4 text-amber-400" />}
          color="border-amber-200 bg-amber-50/40" />
      </div>

      {/* Monthly won revenue */}
      <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Monthly Won Revenue</SectionTitle>
          <div className="flex gap-1">
            {([6, 12] as const).map((m) => (
              <button key={m} onClick={() => setMonths(m)}
                className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors',
                  months === m ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                )}>
                {m}mo
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [formatINR(v), 'Won revenue']} />
            <Bar dataKey="revenue" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Win/Loss trend + Pipeline by stage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
          <SectionTitle>Win / Loss Trend</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={wlData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="won" stroke={CHART_COLORS.green} strokeWidth={2} dot={false} name="Won" />
              <Line type="monotone" dataKey="lost" stroke={CHART_COLORS.rose} strokeWidth={2} dot={false} name="Lost" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
          <SectionTitle>Pipeline Value by Stage</SectionTitle>
          {data.pipeline_by_stage.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No pipeline stages yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.pipeline_by_stage} layout="vertical" margin={{ top: 0, right: 10, left: 70, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="stage_name" type="category" tick={{ fontSize: 11 }} width={66} />
                <Tooltip formatter={(v: number) => [formatINR(v), '']} />
                <Legend />
                <Bar dataKey="total_value" name="Total" fill={CHART_COLORS.indigo} radius={[0, 4, 4, 0]} stackId="a" />
                <Bar dataKey="weighted_value" name="Weighted" fill={CHART_COLORS.purple} radius={[0, 4, 4, 0]} stackId="b" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top open deals */}
      {data.top_deals.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
          <SectionTitle>Top Open Deals by Value</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Deal</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Stage</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Value</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Probability</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Close Date</th>
                </tr>
              </thead>
              <tbody>
                {data.top_deals.map((d) => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-900">{d.title}</td>
                    <td className="py-2 text-gray-500 text-xs">{d.stage_name ?? '—'}</td>
                    <td className="py-2 text-right font-medium">{formatINR(d.value_inr)}</td>
                    <td className="py-2 text-right text-gray-500">{d.probability ?? '—'}%</td>
                    <td className="py-2 text-right text-gray-500 text-xs">
                      {d.close_date
                        ? new Date(d.close_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Outreach tab ─────────────────────────────────────────────────────────────

function ChannelCard({
  title, icon, stats,
}: {
  title: string
  icon: React.ReactNode
  stats: { label: string; value: string | number; highlight?: boolean }[]
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">{s.label}</p>
            <p className={cn('text-lg font-bold', s.highlight ? 'text-indigo-600' : 'text-gray-900')}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function OutreachTab() {
  const { data, isLoading, isError, refetch } = useOutreachReport()

  if (isLoading) return <TabSkeleton />
  if (isError || !data) return <ErrorState onRetry={refetch} />

  return (
    <div className="space-y-6">
      {/* Channel summary bar */}
      <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
        <SectionTitle>Sent vs Replied by Channel</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.channel_summary} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="sent" name="Sent" fill={CHART_COLORS.indigo} radius={[4, 4, 0, 0]} />
            <Bar dataKey="replied" name="Replied" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-channel cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChannelCard
          title="Email Campaigns"
          icon={<Mail className="w-4 h-4 text-indigo-500" />}
          stats={[
            { label: 'Campaigns', value: data.email_campaigns.length },
            { label: 'Total Sent', value: data.channel_summary.find(c => c.channel === 'Email Campaigns')?.sent ?? 0 },
            { label: 'Avg Open Rate', value: data.email_campaigns.length > 0
              ? `${Math.round(data.email_campaigns.reduce((a, c) => a + c.open_rate, 0) / data.email_campaigns.length)}%`
              : '0%', highlight: true },
            { label: 'Avg Reply Rate', value: data.email_campaigns.length > 0
              ? `${Math.round(data.email_campaigns.reduce((a, c) => a + c.reply_rate, 0) / data.email_campaigns.length)}%`
              : '0%', highlight: true },
          ]}
        />
        <ChannelCard
          title="WhatsApp"
          icon={<MessageCircle className="w-4 h-4 text-green-500" />}
          stats={[
            { label: 'Total Messages', value: data.whatsapp.total },
            { label: 'Delivered', value: data.whatsapp.delivered + data.whatsapp.read },
            { label: 'Read', value: data.whatsapp.read },
            { label: 'Reply Rate', value: `${data.whatsapp.reply_rate}%`, highlight: true },
          ]}
        />
        <ChannelCard
          title="LinkedIn"
          icon={<Linkedin className="w-4 h-4 text-sky-600" />}
          stats={[
            { label: 'Total Messages', value: data.linkedin.total },
            { label: 'Sent', value: data.linkedin.sent },
            { label: 'Connection Rate', value: `${data.linkedin.connection_rate}%`, highlight: true },
            { label: 'Reply Rate', value: `${data.linkedin.reply_rate}%`, highlight: true },
          ]}
        />
        <ChannelCard
          title="Email Sequences"
          icon={<Mail className="w-4 h-4 text-purple-500" />}
          stats={[
            { label: 'Sequences', value: data.email_sequences.total_sequences },
            { label: 'Active Enrolled', value: data.email_sequences.active_enrollments },
            { label: 'Completion Rate', value: `${data.email_sequences.completion_rate}%`, highlight: true },
            { label: 'Reply Rate', value: `${data.email_sequences.reply_rate}%`, highlight: true },
          ]}
        />
      </div>

      {/* Campaign performance table */}
      {data.email_campaigns.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
          <SectionTitle>Campaign Performance</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Campaign</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Sent</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Opened</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Open %</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Replied</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Reply %</th>
                </tr>
              </thead>
              <tbody>
                {data.email_campaigns.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-900 max-w-[180px] truncate">{c.name}</td>
                    <td className="py-2 text-right text-gray-600">{c.sent}</td>
                    <td className="py-2 text-right text-gray-600">{c.opened}</td>
                    <td className="py-2 text-right">
                      <span className={cn('font-medium', c.open_rate >= 20 ? 'text-green-600' : 'text-gray-600')}>{c.open_rate}%</span>
                    </td>
                    <td className="py-2 text-right text-gray-600">{c.replied}</td>
                    <td className="py-2 text-right">
                      <span className={cn('font-medium', c.reply_rate >= 5 ? 'text-indigo-600' : 'text-gray-600')}>{c.reply_rate}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Activities tab ───────────────────────────────────────────────────────────

const ACTIVITY_COLORS: Record<string, string> = {
  call:    CHART_COLORS.sky,
  email:   CHART_COLORS.indigo,
  meeting: CHART_COLORS.purple,
  note:    CHART_COLORS.amber,
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  call:    <PhoneCall className="w-3.5 h-3.5 text-sky-400" />,
  email:   <Mail className="w-3.5 h-3.5 text-indigo-400" />,
  meeting: <Calendar className="w-3.5 h-3.5 text-purple-400" />,
  note:    <FileText className="w-3.5 h-3.5 text-amber-400" />,
}

function ActivitiesTab() {
  const [weeks, setWeeks] = useState<4 | 8 | 12>(8)
  const { data, isLoading, isError, refetch } = useActivitiesReport(weeks)

  if (isLoading) return <TabSkeleton />
  if (isError || !data) return <ErrorState onRetry={refetch} />

  const weeklyData = data.weekly.map((w) => ({ ...w, label: fmtWeek(w.week) }))
  const totalActivities = data.by_type.reduce((a, t) => a + t.count, 0)

  return (
    <div className="space-y-6">
      {/* Type summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['call', 'email', 'meeting', 'note'].map((t) => {
          const found = data.by_type.find((b) => b.type === t)
          const count = found?.count ?? 0
          const labels: Record<string, string> = { call: 'Calls', email: 'Emails', meeting: 'Meetings', note: 'Notes' }
          return (
            <div key={t} className="rounded-2xl border border-border/60 bg-white shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                {ACTIVITY_ICONS[t]}
                <p className="text-xs font-medium text-gray-600">{labels[t]}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-400 mt-0.5">{pct(count, totalActivities)}% of total</p>
            </div>
          )
        })}
      </div>

      {/* Weekly stacked bar */}
      <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Activity by Week</SectionTitle>
          <div className="flex gap-1">
            {([4, 8, 12] as const).map((w) => (
              <button key={w} onClick={() => setWeeks(w)}
                className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
                  weeks === w ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white' : 'text-muted-foreground hover:bg-muted'
                )}>
                {w}w
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="call" name="Call" stackId="a" fill={ACTIVITY_COLORS.call} />
            <Bar dataKey="email" name="Email" stackId="a" fill={ACTIVITY_COLORS.email} />
            <Bar dataKey="meeting" name="Meeting" stackId="a" fill={ACTIVITY_COLORS.meeting} />
            <Bar dataKey="note" name="Note" stackId="a" fill={ACTIVITY_COLORS.note} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent activity feed */}
      <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
        <SectionTitle>Recent Activity Feed</SectionTitle>
        {data.recent.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No activities logged yet.</p>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {data.recent.map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  {ACTIVITY_ICONS[a.type] ?? <FileText className="w-3.5 h-3.5 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{a.note}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.type} · {a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    </div>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center">
        <AlertCircle className="w-7 h-7 text-rose-400" />
      </div>
      <div>
        <p className="text-base font-bold text-foreground">Failed to load report</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          The backend could not be reached or returned an error.
          Check that the Railway service is running and the API URL is configured.
        </p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90 transition-all"
      >
        <RefreshCw className="w-4 h-4" />
        Retry
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('leads')

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Reports &amp; Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Comprehensive insights across leads, revenue, outreach channels, and team activity.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 rounded-2xl border border-border/60 bg-white shadow-sm p-1.5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all',
              activeTab === t.key
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'leads'      && <LeadsTab />}
      {activeTab === 'revenue'    && <RevenueTab />}
      {activeTab === 'outreach'   && <OutreachTab />}
      {activeTab === 'activities' && <ActivitiesTab />}
    </div>
  )
}
