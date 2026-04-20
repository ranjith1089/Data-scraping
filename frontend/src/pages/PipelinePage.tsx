import { useSearchParams } from 'react-router-dom'
import { LayoutGrid, Filter as FilterIcon } from 'lucide-react'
import { usePipeline } from '@/hooks/useAnalytics'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatINR } from '@/lib/utils'
import LeadKanban from '@/components/pipeline/LeadKanban'

// Stage metadata matches the reference Pipeline.tsx exactly: the main body
// color is used for the 3D trapezoid fill and the rim is a lighter shade
// used for the top ellipse to create the 3D effect.
const STAGE_META: Record<
  string,
  { label: string; desc: string; main: string; rim: string }
> = {
  new: {
    label: 'Awareness',
    desc: 'Discovering your product or service',
    main: '#e05050',
    rim: '#f09090',
  },
  contacted: {
    label: 'Interest',
    desc: 'Engaging with content and offerings',
    main: '#f09640',
    rim: '#f8c080',
  },
  engaged: {
    label: 'Consideration',
    desc: 'Evaluating whether it fits their needs',
    main: '#e8c840',
    rim: '#f4de85',
  },
  negotiation: {
    label: 'Intent',
    desc: 'Negotiating price and terms',
    main: '#52b06a',
    rim: '#85d4a0',
  },
  demo: {
    label: 'Demo',
    desc: 'Live product demonstration scheduled',
    main: '#4ab0d8',
    rim: '#82ccec',
  },
  proposal: {
    label: 'Proposal',
    desc: 'Formal proposal sent and under review',
    main: '#4462d8',
    rim: '#7b90ec',
  },
  won: {
    label: 'Won',
    desc: 'Deal closed and contract signed',
    main: '#1a3470',
    rim: '#4b6aaa',
  },
}

const STAGE_ORDER = [
  'new',
  'contacted',
  'engaged',
  'negotiation',
  'demo',
  'proposal',
  'won',
]

// 3D funnel geometry constants — copied verbatim from the reference source.
const SVG_W = 400
const CX = 200
const MAX_R = 186
const MIN_R = 30
const SEG_H = 64
const TOP_PAD = 18
const ER = 0.18

interface Stage {
  stage: string
  count: number
  value: number
}

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
    <svg
      viewBox={`0 0 ${SVG_W} ${svgH}`}
      width="100%"
      height={430}
      style={{ display: 'block' }}
    >
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
            <path
              d={`M ${CX - topR} ${topY} L ${CX + topR} ${topY} L ${CX + botR} ${botY} L ${CX - botR} ${botY} Z`}
              fill={meta.main}
            />
            <path
              d={`M ${CX - botR} ${botY} A ${botR} ${botRy} 0 0 0 ${CX + botR} ${botY}`}
              fill={meta.main}
            />
            <ellipse cx={CX} cy={topY} rx={topR} ry={topRy} fill={meta.rim} />
            <ellipse
              cx={CX}
              cy={topY}
              rx={topR}
              ry={topRy}
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="1.2"
            />
            <text
              x={CX}
              y={topY + SEG_H * 0.52}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="13"
              fontWeight="700"
              fontFamily="Inter, sans-serif"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
            >
              {s.count}
            </text>
          </g>
        )
      })}
      <ellipse
        cx={CX}
        cy={lastBotY}
        rx={lastBotR}
        ry={lastBotRy}
        fill={lastMeta?.main ?? '#1a3470'}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="0.8"
      />
    </svg>
  )
}

type PipelineView = 'funnel' | 'board'

export default function PipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  // View is URL-driven so `/pipeline?view=board` deep-links straight
  // into the Kanban. Funnel is the default for backwards compatibility.
  const viewParam = searchParams.get('view')
  const view: PipelineView = viewParam === 'board' ? 'board' : 'funnel'

  function setView(next: PipelineView) {
    const params = new URLSearchParams(searchParams)
    if (next === 'funnel') params.delete('view')
    else params.set('view', next)
    setSearchParams(params, { replace: true })
  }

  const { data, isLoading } = usePipeline()

  // Build pipeline data in the canonical stage order, pulling from the
  // analytics endpoint. The backend returns stages as an array of
  // { stage, leads, total_value, count }.
  const pipelineData: Stage[] = STAGE_ORDER.map((stageKey) => {
    const match = data?.stages?.find((s) => s.stage === stageKey)
    return {
      stage: stageKey,
      count: match?.count ?? 0,
      value: match?.total_value ?? 0,
    }
  })

  const totalLeads = pipelineData.reduce((a, s) => a + s.count, 0)
  const totalValue = pipelineData.reduce((a, s) => a + s.value, 0)
  const wonCount = pipelineData.find((s) => s.stage === 'won')?.count ?? 0
  const proposalCount =
    pipelineData.find((s) => s.stage === 'proposal')?.count ?? 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Sales Pipeline
          </h1>
          <p className="text-muted-foreground mt-1">
            {view === 'board'
              ? 'Drag leads between columns to move them through stages.'
              : 'Visualize your lead progression through every conversion stage.'}
          </p>
        </div>

        {/* View toggle */}
        <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setView('funnel')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
              view === 'funnel'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <FilterIcon className="h-4 w-4" />
            Funnel
          </button>
          <button
            type="button"
            onClick={() => setView('board')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors',
              view === 'board'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Board
          </button>
        </div>
      </div>

      {/* Board view renders the Kanban and skips everything else on the page. */}
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

// Original funnel + summary cards + breakdown, extracted verbatim so the
// new view toggle can conditionally render them.
function FunnelView({
  pipelineData,
  isLoading,
  totalLeads,
  totalValue,
  wonCount,
  proposalCount,
}: {
  pipelineData: Stage[]
  isLoading: boolean
  totalLeads: number
  totalValue: number
  wonCount: number
  proposalCount: number
}) {
  return (
    <div className="space-y-6">

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading
          ? Array(4)
              .fill(0)
              .map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : [
              { label: 'Total in Pipeline', value: totalLeads, sub: 'leads' },
              {
                label: 'Pipeline Value',
                value: formatINR(totalValue),
                sub: 'estimated',
              },
              {
                label: 'Win Rate',
                value:
                  totalLeads > 0
                    ? `${Math.round((wonCount / totalLeads) * 100)}%`
                    : '0%',
                sub: 'of all leads',
              },
              {
                label: 'In Proposal',
                value: proposalCount,
                sub: 'leads ready to close',
              },
            ].map((stat, i) => (
              <Card key={i}>
                <CardContent className="pt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold mt-1.5 text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Funnel + Labels */}
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>
            Lead progression from first touch to closed deal
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex gap-8">
              <div className="flex-1 space-y-1">
                {Array(7)
                  .fill(0)
                  .map((_, i) => (
                    <Skeleton
                      key={i}
                      className="rounded"
                      style={{
                        height: 52,
                        width: `${100 - i * 10}%`,
                        margin: '0 auto',
                      }}
                    />
                  ))}
              </div>
              <div className="w-60 space-y-4">
                {Array(7)
                  .fill(0)
                  .map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded" />
                  ))}
              </div>
            </div>
          ) : pipelineData.length > 0 ? (
            <div className="flex gap-6 items-start">
              <div className="flex-1 min-w-0">
                <FunnelSVG3D stages={pipelineData} />
              </div>

              <div
                className="w-60 shrink-0 flex flex-col justify-between"
                style={{ height: 430 }}
              >
                {pipelineData.map((s, i) => {
                  const meta = STAGE_META[s.stage]
                  const prevCount = i === 0 ? s.count : pipelineData[i - 1].count
                  const convRate =
                    i === 0
                      ? null
                      : prevCount > 0
                        ? Math.round((s.count / prevCount) * 100)
                        : 0

                  return (
                    <div key={s.stage} className="flex items-start gap-2.5">
                      <div
                        className="mt-1 w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: meta?.main }}
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">
                            {meta?.label ?? s.stage}
                          </span>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: meta?.main }}
                          >
                            {s.count}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                          {meta?.desc}
                        </p>
                        {convRate !== null && (
                          <p
                            className="text-[10px] font-semibold mt-0.5"
                            style={{ color: meta?.main }}
                          >
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
            <div className="py-20 text-center text-muted-foreground">
              No pipeline data available yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage value breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {isLoading
          ? Array(7)
              .fill(0)
              .map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : pipelineData.map((s) => {
              const meta = STAGE_META[s.stage]
              return (
                <Card
                  key={s.stage}
                  className="border-t-4"
                  style={{ borderTopColor: meta?.main }}
                >
                  <CardContent className="pt-3 pb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {meta?.label}
                    </p>
                    <p className="text-xl font-bold mt-1 text-foreground">
                      {s.count}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatINR(s.value)}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
      </div>
    </div>
  )
}
