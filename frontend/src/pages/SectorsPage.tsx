import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts'
import { Briefcase, ArrowUpRight, Loader2, Sparkles, TrendingUp, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useDashboard } from '@/hooks/useAnalytics'
import { useSectorAnalysis, type SectorAnalysis, type SectorRecommendation } from '@/hooks/useAI'
import { Skeleton } from '@/components/ui/skeleton'
import { SECTOR_NAMES, SECTOR_COLORS } from '@/lib/utils'
import { cn } from '@/lib/utils'

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
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Sector analysis failed.'
      toast.error(typeof detail === 'string' ? detail : 'Sector analysis failed')
    }
  }

  const sectors = Object.entries(dashboard?.leads_by_sector ?? {}).map(([code, count]) => ({
    id: code, code, name: SECTOR_NAMES[code] ?? code,
    color: SECTOR_COLORS[code] ?? '#6366f1', leadCount: count as number,
  })).sort((a, b) => b.leadCount - a.leadCount)

  const chartData = sectors.map((s) => ({ sector: s.name, count: s.leadCount, color: s.color }))
  const totalLeads = sectors.reduce((a, s) => a + s.leadCount, 0)

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Sectors Overview</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Analyze your lead distribution and performance across different industries.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Pie chart */}
        <div className="col-span-1 lg:col-span-2 rounded-2xl bg-white border border-border/60 shadow-sm p-5">
          <div className="mb-3">
            <h2 className="text-base font-bold text-foreground">Sector Distribution</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Breakdown of your total leads by industry</p>
          </div>
          <div className="h-[380px]">
            {isLoading ? <Skeleton className="w-full h-full rounded-xl" />
            : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="46%" innerRadius={90} outerRadius={130}
                    paddingAngle={4} dataKey="count" nameKey="sector">
                    {chartData.map((entry, i) => <Cell key={`cell-${i}`} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value) => [value, 'Leads']}
                    contentStyle={{
                      borderRadius: '12px', border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--card))', boxShadow: '0 8px 24px -4px rgba(0,0,0,.08)',
                      fontSize: 12,
                    }}
                  />
                  <Legend verticalAlign="bottom" height={50} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 text-sm">
                No sector data available.
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Sector list */}
          <div className="flex-1 rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-border/60">
              <h2 className="text-sm font-bold text-foreground">Target Sectors</h2>
            </div>
            <div className="p-2 max-h-[280px] overflow-y-auto scrollbar-thin">
              {isLoading ? (
                <div className="space-y-2 p-2">
                  {Array(6).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-9 h-9 rounded-xl" />
                      <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3 w-16" /></div>
                    </div>
                  ))}
                </div>
              ) : sectors.length > 0 ? (
                sectors.map((sector) => {
                  const pct = totalLeads > 0 ? Math.round((sector.leadCount / totalLeads) * 100) : 0
                  return (
                    <button key={sector.id} type="button"
                      onClick={() => navigate(`/leads?sector_code=${encodeURIComponent(sector.code)}`)}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-muted/40 transition-colors group text-left">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${sector.color}18`, color: sector.color }}>
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{sector.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: sector.color }} />
                          </div>
                          <span className="text-[11px] text-muted-foreground font-medium shrink-0">{sector.leadCount}</span>
                        </div>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  )
                })
              ) : (
                <div className="py-10 text-center text-muted-foreground text-sm">No sectors available.</div>
              )}
            </div>
          </div>

          {/* AI expansion card */}
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-5 text-white shadow-lg shadow-indigo-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h3 className="font-bold text-sm">Want to expand?</h3>
            </div>
            <p className="text-white/80 text-xs leading-relaxed mb-4">
              AveonApex can automatically discover new high-potential sectors based on your current won leads.
            </p>
            <button onClick={runAnalysis} disabled={analysisMutation.isPending}
              className="w-full rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 px-4 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {analysisMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Analysing won deals…</>
              ) : (
                <><Sparkles className="h-4 w-4" />Run Sector Analysis</>
              )}
            </button>
          </div>
        </div>
      </div>

      {analysis && (
        <SectorAnalysisModal analysis={analysis} onClose={() => setAnalysis(null)}
          onViewSector={(code) => navigate(`/leads?sector_code=${encodeURIComponent(code)}`)} />
      )}
    </div>
  )
}

// ── Sector Analysis Modal ─────────────────────────────────────────────────────
function SectorAnalysisModal({ analysis, onClose, onViewSector }: {
  analysis: SectorAnalysis; onClose: () => void; onViewSector: (code: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-border/60" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-white px-6 py-4 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Sector expansion analysis</h2>
              <p className="text-xs text-muted-foreground">
                Based on {analysis.based_on_won_leads} won deal{analysis.based_on_won_leads === 1 ? '' : 's'} · {new Date(analysis.generated_at).toLocaleString()}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-6 px-6 py-5">
          {analysis.summary && (
            <section>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Win pattern read</p>
              <p className="text-sm leading-relaxed text-foreground">{analysis.summary}</p>
            </section>
          )}
          {analysis.current_sector_mix.length > 0 && (
            <section>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current won-deal mix</p>
              <div className="flex flex-wrap gap-2">
                {analysis.current_sector_mix.map((row) => (
                  <span key={row.sector_code}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-foreground">
                    <Briefcase className="h-3 w-3 text-muted-foreground" />
                    {row.sector_name} <span className="text-muted-foreground">· {row.won_count}</span>
                  </span>
                ))}
              </div>
            </section>
          )}
          <section>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recommended sectors to expand into</p>
            <div className="space-y-3">
              {analysis.recommendations.map((rec) => (
                <RecommendationCard key={rec.sector_code} rec={rec} onView={() => onViewSector(rec.sector_code)} />
              ))}
            </div>
          </section>
        </div>
        <div className="sticky bottom-0 flex justify-end border-t border-border/60 bg-white px-6 py-4 rounded-b-2xl">
          <button onClick={onClose}
            className="h-9 px-4 rounded-xl border border-border/60 bg-white text-sm font-medium text-muted-foreground hover:bg-muted transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function RecommendationCard({ rec, onView }: { rec: SectorRecommendation; onView: () => void }) {
  const scoreCls = rec.fit_score >= 75
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : rec.fit_score >= 50 ? 'bg-amber-50 text-amber-700 ring-amber-200'
    : 'bg-muted text-muted-foreground ring-border'

  return (
    <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <h4 className="text-sm font-bold text-foreground">{rec.sector_name}</h4>
          <span className={cn('inline-flex items-center rounded-full ring-1 ring-inset px-2 py-0.5 text-[11px] font-bold', scoreCls)}>
            Fit {rec.fit_score}/100
          </span>
        </div>
        <button type="button" onClick={onView}
          className="text-xs font-semibold text-primary hover:underline shrink-0">
          View leads →
        </button>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{rec.rationale}</p>
      {rec.recommended_icp && (
        <div className="mb-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
          <span className="font-semibold">Ideal customer:</span> {rec.recommended_icp}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rec.signals.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Supporting signals</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {rec.signals.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {rec.sample_designations.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target designations</p>
            <div className="flex flex-wrap gap-1">
              {rec.sample_designations.map((d, i) => (
                <span key={i} className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground font-medium">{d}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
