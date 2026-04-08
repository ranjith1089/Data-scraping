import { cn } from '@/lib/utils'

interface FunnelData {
  awareness: number
  interest: number
  consideration: number
  intent: number
  demo: number
  proposal: number
  won: number
}

interface FunnelChartProps {
  data: FunnelData
}

const STAGES: { key: keyof FunnelData; label: string; color: string }[] = [
  { key: 'awareness', label: 'Awareness', color: 'bg-blue-500' },
  { key: 'interest', label: 'Interest', color: 'bg-blue-400' },
  { key: 'consideration', label: 'Consideration', color: 'bg-cyan-500' },
  { key: 'intent', label: 'Intent', color: 'bg-teal-500' },
  { key: 'demo', label: 'Demo', color: 'bg-emerald-500' },
  { key: 'proposal', label: 'Proposal', color: 'bg-green-500' },
  { key: 'won', label: 'Won', color: 'bg-green-600' },
]

export default function FunnelChart({ data }: FunnelChartProps) {
  const maxValue = Math.max(...Object.values(data), 1)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="mb-5 text-sm font-semibold text-gray-900">
        Sales Funnel
      </h3>
      <div className="flex flex-col items-center gap-1.5">
        {STAGES.map((stage, idx) => {
          const count = data[stage.key]
          const widthPct = Math.max((count / maxValue) * 100, 18)
          const prevCount = idx > 0 ? data[STAGES[idx - 1].key] : null
          const conversionRate =
            prevCount && prevCount > 0
              ? ((count / prevCount) * 100).toFixed(1)
              : null

          return (
            <div key={stage.key} className="flex w-full flex-col items-center">
              {conversionRate !== null && (
                <span className="mb-0.5 text-[10px] font-medium text-gray-400">
                  {conversionRate}% conversion
                </span>
              )}
              <div
                className={cn(
                  'relative flex items-center justify-between rounded-md px-4 py-2.5 text-white transition-all',
                  stage.color
                )}
                style={{ width: `${widthPct}%`, minWidth: '140px' }}
              >
                <span className="text-xs font-semibold">{stage.label}</span>
                <span className="text-sm font-bold">{count.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
