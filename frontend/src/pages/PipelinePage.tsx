import { useSearchParams } from 'react-router-dom'
import { LayoutGrid, Filter as FilterIcon, TrendingUp, Trophy, AlertTriangle, Target } from 'lucide-react'
import { usePipeline } from '@/hooks/useAnalytics'
import { useRevenueForecast } from '@/hooks/usePipelineDeals'
import { CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatINR } from '@/lib/utils'
import LeadKanban from '@/components/pipeline/LeadKanban'

const STAGE_META: Record<string, { label: string; desc: string; main: string; rim: string }> = {
  new:         { label: 'Awareness',   desc: 'Discovering your product or service',    main: '#e05050', rim: '#f09090' },
  contacted:   { label: 'Interest',    desc: 'First-touch outreach completed',          main: '#f09640', rim: '#f8c080' },
  qualified:   { label: 'Qualified',   desc: 'Lead meets ICP and buying criteria',      main: '#e8c840', rim: '#f4de85' },
  proposal:    { label: 'Proposal',    desc: 'Formal proposal sent and under review',   main: '#4462d8', rim: '#7b90ec' },
  negotiation: { label: 'Negotiation', desc: 'Negotiating price and terms',             main: '#52b06a', rim: '#85d4a0' },
  won:         { label: 'Won',         desc: 'Deal closed and contract signed',         main: '#1a3470', rim: '#4b6aaa' },
}

const STAGE_ORDER = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won']

const SVG_W = 400
const CX = 200
const MAX_R = 186
const MIN_R = 30
const SEG_H = 64
const TOP_PAD = 18
const ER = 0.18

interface Stage { stage: string; count: number; value: number }

function getR(i: number, n: number): number {
  return MAX_R - (i / n) * (MAX_R - MIN_R)
}

function FunnelSVG3D({ stages }: { stages: Stage[] }) {
  const n = stages.length
  const svgH = n * SEG_H + TOP_PAD + 24
  const lastMeta = STAGE_META[stages[n - 1]?.stage]
  const lastBotR = getR(n, n)
  const lastBotY = TOP_PAD + n * SEG_H
  const lastBotRy = lastBotR * ER

  return (
    <svg viewBox={`0 0 ${SVG_W} ${svgH}`} width="100%" height={430} style={{ display: 'block' }}>
      {[...stages].reverse().map((s, ri) => {
        const i = n - 1 - ri
        const meta = STAGE_META[s.stage] ?? { main: '#4361ee', rim: '#7b96f4' }
        const topR = getR(i, n)
        const botR = getR(i + 1, n)
        const topY = TOP_PAD + i * SEG_H
        const botY = TOP_PAD + (i + 1) * SEG_H
        const topRy = topR * ER
        const botRy = botR * ER
        return (
          <g key={s.stage}>
            <path d={`M ${CX - topR} ${topY} L ${CX + topR} ${topY} L ${CX + botR} ${botY} L ${CX - botR} ${botY} Z`} fill={meta.main} />
            <path d={`M ${CX - botR} ${botY} A ${botR} ${botRy} 0 0 0 ${CX + botR} ${botY}`} fill={meta.main} />
            <ellipse cx={CX} cy={topY} rx={topR} ry={topRy} fill={meta.rim} />
            <ellipse cx={CX} cy={topY} rx={topR} ry={topRy} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
            <text x={CX} y={topY + SEG_H * 0.52} textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
              {s.count}
            </text>
          </g>
        )
      })}
      <ellipse cx={CX} cy={lastBotY} rx={lastBotR} ry={lastBotRy}
        fill={lastMeta?.main ?? '#1a3470'} stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
    </svg>
  )
}

// ── Revenue forecast bar ──────────────────────────────────────────────────────

const FORECAST_CONFIG = [
  { key: 'pipeline',   label: 'Total Pipeline',  icon: TrendingUp,   gradient: 'from-indigo-500 to-violet-600', shadow: 'shadow-indigo-100' },
  { key: 'weighted',   label: 'Weighted Value',  icon: Target,       gradient: 'from-purple-500 to-fuchsia-600', shadow: 'shadow-purple-100' },
  { key: 'won',        label: 'Won This Month',  icon: Trophy,       gradient: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-100' },
  { key: 'winrate',    label: 'Win Rate',        icon: TrendingUp,   gradient: 'from-sky-500 to-cyan-500', shadow: 'shadow-sky-100' },
  { key: 'overdue',    label: 'Overdue Deals',   icon: AlertTriangle, gradient: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-100' },
]

function RevenueBar() {
  const { data: fc, isLoading } = useRevenueForecast()

  if (isLoading) return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
    </div>
  )
  if (!fc) return null

  const stats = [
    { ...FORECAST_CONFIG[0], value: formatINR(fc.total_pipeline_inr),    sub: `${fc.open_count} open deals` },
    { ...FORECAST_CONFIG[1], value: formatINR(fc.weighted_pipeline_inr),  sub: 'probability-adjusted' },
    { ...FORECAST_CONFIG[2], value: formatINR(fc.won_this_month_inr),     sub: `${fc.won_this_month_count} deal${fc.won_this_month_count !== 1 ? 's' : ''}` },
    { ...FORECAST_CONFIG[3], value: `${Math.round(fc.win_rate)}%`,        sub: `${fc.won_count} won · ${fc.lost_count} lost` },
    {
      ...FORECAST_CONFIG[4],
      value: String(fc.overdue_deals),
      sub: `${fc.deals_closing_this_month} closing soon`,
      gradient: fc.overdue_deals > 0 ? FORECAST_CONFIG[4].gradient : 'from-slate-400 to-slate-500',
      shadow: fc.overdue_deals > 0 ? FORECAST_CONFIG[4].shadow : 'shadow-slate-100',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {stats.map((s) => {
        const Icon = s.icon
        return (
          <div key={s.key} className="relative overflow-hidden rounded-2xl bg-white border border-border/60 shadow-sm p-4 card-lift">
            <div className={cn('absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r', s.gradient)} />
            <div className="flex items-start justify-between mt-0.5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <p className="text-xl font-extrabold text-foreground mt-1">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
              </div>
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm shrink-0', s.gradient, s.shadow)}>
                <Icon className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

type PipelineView = 'funnel' | 'board'

export default function PipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const viewParam = searchParams.get('view')
  const view: PipelineView = viewParam === 'board' ? 'board' : 'funnel'

  function setView(next: PipelineView) {
    const params = new URLSearchParams(searchParams)
    if (next === 'funnel') { params.delete('view') } else { params.set('view', next) }
    setSearchParams(params, { replace: true })
  }

  const { data, isLoading } = usePipeline()

  const pipelineData: Stage[] = STAGE_ORDER.map((stageKey) => {
    const match = data?.stages?.find((s) => s.stage === stageKey)
    return { stage: stageKey, count: match?.count ?? 0, value: match?.total_value ?? 0 }
  })

  const totalLeads = pipelineData.reduce((a, s) => a + s.count, 0)
  const totalValue = pipelineData.reduce((a, s) => a + s.value, 0)
  const wonCount = pipelineData.find((s) => s.stage === 'won')?.count ?? 0
  const proposalCount = pipelineData.find((s) => s.stage === 'proposal')?.count ?? 0

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Sales Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {view === 'board'
              ? 'Drag leads between columns to move them through stages.'
              : 'Visualize your lead progression through every conversion stage.'}
          </p>
        </div>

        {/* View toggle */}
        <div className="inline-flex rounded-xl border border-border/60 bg-white p-1 text-sm shadow-sm">
          {(['funnel', 'board'] as PipelineView[]).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-semibold capitalize transition-all',
                view === v
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}>
              {v === 'funnel' ? <FilterIcon className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue stats */}
      <RevenueBar />

      {view === 'board' && <LeadKanban />}
      {view === 'funnel' && (
        <FunnelView
          pipelineData={pipelineData}
          isLoading={isLoading}
          totalLeads={totalLeads}
          totalValue={totalValue}
          wonCount={wonCount}
          proposalCount={proposalCount}
        />
      )}
    </div>
  )
}

function FunnelView({ pipelineData, isLoading, totalLeads, totalValue, wonCount, proposalCount }: {
  pipelineData: Stage[]; isLoading: boolean;
  totalLeads: number; totalValue: number; wonCount: number; proposalCount: number;
}) {
  const summaryCards = [
    { label: 'Total in Pipeline', value: totalLeads, sub: 'leads', gradient: 'from-indigo-500 to-violet-600' },
    { label: 'Pipeline Value', value: formatINR(totalValue), sub: 'estimated', gradient: 'from-sky-500 to-cyan-500' },
    { label: 'Win Rate', value: totalLeads > 0 ? `${Math.round((wonCount / totalLeads) * 100)}%` : '0%', sub: 'of all leads', gradient: 'from-emerald-500 to-teal-500' },
    { label: 'In Proposal', value: proposalCount, sub: 'ready to close', gradient: 'from-orange-500 to-rose-500' },
  ]

  return (
    <div className="space-y-5">

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading
          ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
          : summaryCards.map((stat, i) => (
            <div key={i} className="relative overflow-hidden rounded-2xl bg-white border border-border/60 shadow-sm p-4 card-lift">
              <div className={cn('absolute top-0 inset-x-0 h-1 bg-gradient-to-r rounded-t-2xl', stat.gradient)} />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{stat.label}</p>
              <p className="text-2xl font-extrabold mt-1.5 text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
            </div>
          ))}
      </div>

      {/* Funnel + Labels */}
      <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h2 className="text-base font-bold text-foreground">Conversion Funnel</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Lead progression from first touch to closed deal</p>
        </div>
        <div className="p-5">
          {isLoading ? (
            <div className="flex gap-8">
              <div className="flex-1 space-y-1">
                {Array(7).fill(0).map((_, i) => (
                  <Skeleton key={i} className="rounded" style={{ height: 52, width: `${100 - i * 10}%`, margin: '0 auto' }} />
                ))}
              </div>
              <div className="w-60 space-y-4">{Array(7).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            </div>
          ) : pipelineData.length > 0 ? (
            <div className="flex gap-6 items-start">
              <div className="flex-1 min-w-0">
                <FunnelSVG3D stages={pipelineData} />
              </div>
              <div className="w-64 shrink-0 flex flex-col justify-between" style={{ height: 430 }}>
                {pipelineData.map((s, i) => {
                  const meta = STAGE_META[s.stage]
                  const prevCount = i === 0 ? s.count : pipelineData[i - 1].count
                  const convRate = i === 0 ? null : prevCount > 0 ? Math.round((s.count / prevCount) * 100) : 0
                  return (
                    <div key={s.stage} className="flex items-start gap-3 p-2 rounded-xl hover:bg-muted/30 transition-colors">
                      <div className="mt-1.5 w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: meta?.main }} />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">{meta?.label ?? s.stage}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: meta?.main }}>
                            {s.count}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{meta?.desc}</p>
                        {convRate !== null && (
                          <p className="text-[10px] font-semibold mt-0.5" style={{ color: meta?.main }}>
                            {convRate}% from previous
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-muted-foreground/50 text-sm">No pipeline data available yet.</div>
          )}
        </div>
      </div>

      {/* Stage value breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {isLoading
          ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
          : pipelineData.map((s) => {
              const meta = STAGE_META[s.stage]
              return (
                <div key={s.stage} className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden card-lift">
                  <div className="h-1" style={{ background: `linear-gradient(90deg, ${meta?.main}, ${meta?.rim})` }} />
                  <CardContent className="pt-3 pb-4 px-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{meta?.label}</p>
                    <p className="text-2xl font-extrabold mt-1 text-foreground">{s.count}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatINR(s.value)}</p>
                  </CardContent>
                </div>
              )
            })}
      </div>
    </div>
  )
}
