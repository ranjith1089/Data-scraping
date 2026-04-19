import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import {
  Briefcase,
  ArrowUpRight,
  Loader2,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useDashboard } from '@/hooks/useAnalytics'
import {
  useSectorAnalysis,
  type SectorAnalysis,
  type SectorRecommendation,
} from '@/hooks/useAI'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { SECTOR_NAMES, SECTOR_COLORS } from '@/lib/utils'

export default function SectorsPage() {
  const { data: dashboard, isLoading } = useDashboard()
  const navigate = useNavigate()
  const analysisMutation = useSectorAnalysis()
  const [analysis, setAnalysis] = useState<SectorAnalysis | null>(null)

  const runAnalysis = async () => {
    try {
      const result = await analysisMutation.mutateAsync()
      setAnalysis(result)
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail ?? 'Sector analysis failed. Please try again.'
      toast.error(typeof detail === 'string' ? detail : 'Sector analysis failed')
    }
  }

  const sectors = Object.entries(dashboard?.leads_by_sector ?? {}).map(
    ([code, count]) => ({
      id: code,
      code,
      name: SECTOR_NAMES[code] ?? code,
      color: SECTOR_COLORS[code] ?? '#3B82F6',
      leadCount: count as number,
    }),
  )

  const chartData = sectors.map((s) => ({
    sector: s.name,
    count: s.leadCount,
    color: s.color,
  }))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Sectors Overview
        </h1>
        <p className="text-muted-foreground mt-1">
          Analyze your lead distribution and performance across different industries.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Sector Distribution</CardTitle>
            <CardDescription>Breakdown of your total leads by industry</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            {isLoading ? (
              <Skeleton className="w-full h-full rounded-xl" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={100}
                    outerRadius={140}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="sector"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value) => [value, 'Leads']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--card))',
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No sector data available.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Target Sectors</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Skeleton className="w-8 h-8 rounded-md" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-4 w-12" />
                      </div>
                    ))}
                </div>
              ) : sectors.length > 0 ? (
                <div className="space-y-1">
                  {sectors.map((sector) => (
                    <button
                      key={sector.id}
                      type="button"
                      onClick={() =>
                        navigate(`/leads?sector_code=${encodeURIComponent(sector.code)}`)
                      }
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-md flex items-center justify-center"
                          style={{
                            backgroundColor: `${sector.color}20`,
                            color: sector.color,
                          }}
                        >
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-foreground">
                          {sector.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-muted-foreground">
                          {sector.leadCount} leads
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  No sectors available.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground border-transparent">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-2">Want to expand?</h3>
              <p className="text-primary-foreground/80 text-sm mb-4">
                LeadForge AI can automatically discover new high-potential sectors based
                on your current won leads.
              </p>
              <Button
                variant="secondary"
                className="w-full font-medium"
                onClick={runAnalysis}
                disabled={analysisMutation.isPending}
              >
                {analysisMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analysing won deals…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Run Sector Analysis
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {analysis && (
        <SectorAnalysisModal
          analysis={analysis}
          onClose={() => setAnalysis(null)}
          onViewSector={(code) => navigate(`/leads?sector_code=${encodeURIComponent(code)}`)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sector Analysis results modal
// ---------------------------------------------------------------------------

function SectorAnalysisModal({
  analysis,
  onClose,
  onViewSector,
}: {
  analysis: SectorAnalysis
  onClose: () => void
  onViewSector: (code: string) => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Sector expansion analysis
              </h2>
              <p className="text-xs text-gray-500">
                Based on {analysis.based_on_won_leads} won deal
                {analysis.based_on_won_leads === 1 ? '' : 's'} ·{' '}
                {new Date(analysis.generated_at).toLocaleString()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-6 px-6 py-5">
          {/* Summary */}
          {analysis.summary && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Win pattern read
              </h3>
              <p className="text-sm leading-relaxed text-gray-800">
                {analysis.summary}
              </p>
            </section>
          )}

          {/* Current mix */}
          {analysis.current_sector_mix.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Current won-deal mix
              </h3>
              <div className="flex flex-wrap gap-2">
                {analysis.current_sector_mix.map((row) => (
                  <span
                    key={row.sector_code}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
                  >
                    <Briefcase className="h-3 w-3 text-gray-400" />
                    <span className="font-medium">{row.sector_name}</span>
                    <span className="text-gray-500">· {row.won_count}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Recommendations */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Recommended sectors to expand into
            </h3>
            <div className="space-y-4">
              {analysis.recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.sector_code}
                  rec={rec}
                  onView={() => onViewSector(rec.sector_code)}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end border-t border-gray-100 bg-white px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

function RecommendationCard({
  rec,
  onView,
}: {
  rec: SectorRecommendation
  onView: () => void
}) {
  const scoreColor =
    rec.fit_score >= 75
      ? 'bg-green-50 text-green-700 border-green-200'
      : rec.fit_score >= 50
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-gray-50 text-gray-600 border-gray-200'

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-indigo-500" />
          <h4 className="text-sm font-semibold text-gray-900">
            {rec.sector_name}
          </h4>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${scoreColor}`}
          >
            Fit {rec.fit_score}/100
          </span>
        </div>
        <button
          type="button"
          onClick={onView}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          View leads →
        </button>
      </div>

      <p className="mb-3 text-sm leading-relaxed text-gray-700">{rec.rationale}</p>

      {rec.recommended_icp && (
        <div className="mb-3 rounded-lg bg-indigo-50/50 px-3 py-2 text-xs text-indigo-900">
          <span className="font-semibold">Ideal customer:</span> {rec.recommended_icp}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rec.signals.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Supporting signals
            </p>
            <ul className="space-y-1 text-xs text-gray-600">
              {rec.signals.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rec.sample_designations.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Target designations
            </p>
            <div className="flex flex-wrap gap-1">
              {rec.sample_designations.map((d, i) => (
                <span
                  key={i}
                  className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
