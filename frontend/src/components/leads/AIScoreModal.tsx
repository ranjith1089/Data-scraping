import { useState } from 'react'
import {
  X,
  Brain,
  Loader2,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react'
import { useLeadScore, type ScoreResult } from '@/hooks/useAI'
import { useLeads } from '@/hooks/useLeads'
import { cn, getScoreBadge, getICPBadge } from '@/lib/utils'
import toast from 'react-hot-toast'

interface AIScoreModalProps {
  leadIds: string[]
  onClose: () => void
}

export default function AIScoreModal({ leadIds, onClose }: AIScoreModalProps) {
  const scoreLeads = useLeadScore()
  const { data: leadsData } = useLeads({})

  const [results, setResults] = useState<ScoreResult[]>([])
  const [phase, setPhase] = useState<'ready' | 'scoring' | 'done'>('ready')

  // Build lookup for old scores
  const oldScores: Record<string, number> = {}
  if (leadsData?.items) {
    for (const lead of leadsData.items) {
      oldScores[lead.id] = lead.lead_score ?? 0
    }
  }

  // Build name lookup
  const leadNames: Record<string, string> = {}
  if (leadsData?.items) {
    for (const lead of leadsData.items) {
      leadNames[lead.id] = lead.company_name
    }
  }

  async function handleStartScoring() {
    setPhase('scoring')
    try {
      const res = await scoreLeads.mutateAsync({ lead_ids: leadIds })
      setResults(res)
      setPhase('done')
      toast.success(`Scored ${res.length} leads`)
    } catch {
      toast.error('Scoring failed')
      setPhase('ready')
    }
  }

  // Stats
  const avgScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0

  const icpCounts: Record<string, number> = {}
  for (const r of results) {
    icpCounts[r.icp_fit] = (icpCounts[r.icp_fit] || 0) + 1
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                <Brain className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">AI Lead Scoring</h2>
                <p className="text-sm text-gray-500">{leadIds.length} lead{leadIds.length !== 1 ? 's' : ''} to score</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Ready State */}
            {phase === 'ready' && (
              <div className="text-center">
                <p className="mb-6 text-sm text-gray-600">
                  Claude AI will analyze each lead based on company profile, sector fit, engagement history,
                  and ideal customer profile to generate a quality score and ICP match rating.
                </p>
                <button
                  onClick={handleStartScoring}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Brain className="h-5 w-5" /> Start Scoring
                </button>
              </div>
            )}

            {/* Scoring State */}
            {phase === 'scoring' && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                <p className="mt-4 text-sm font-medium text-gray-900">
                  Scoring leads with AI...
                </p>
                <p className="mt-1 text-xs text-gray-500">This may take a moment</p>
                <div className="mt-4 h-2 w-64 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full animate-pulse rounded-full bg-indigo-500" style={{ width: '60%' }} />
                </div>
              </div>
            )}

            {/* Done State */}
            {phase === 'done' && (
              <div className="space-y-5">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-indigo-50 p-3 text-center">
                    <p className="text-2xl font-bold text-indigo-700">{avgScore}</p>
                    <p className="text-xs font-medium text-indigo-600">Avg Score</p>
                  </div>
                  {Object.entries(icpCounts).map(([icp, count]) => {
                    const badge = getICPBadge(icp)
                    return (
                      <div key={icp} className={cn('rounded-lg border p-3 text-center', badge.color)}>
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-xs font-medium capitalize">{icp}</p>
                      </div>
                    )
                  })}
                </div>

                {/* Results Table */}
                <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500">Lead</th>
                        <th className="px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500">Old Score</th>
                        <th className="px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500">New Score</th>
                        <th className="px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500">Change</th>
                        <th className="px-4 py-2.5 text-center text-xs font-medium uppercase text-gray-500">ICP</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium uppercase text-gray-500">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {results.map((r) => {
                        const oldScore = oldScores[r.lead_id] ?? 0
                        const delta = r.score - oldScore
                        const newBadge = getScoreBadge(r.score)
                        const icpBadge = getICPBadge(r.icp_fit)
                        return (
                          <tr key={r.lead_id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                              {leadNames[r.lead_id] || r.lead_id.slice(0, 8)}
                            </td>
                            <td className="px-4 py-2.5 text-center text-sm text-gray-500">{oldScore}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', newBadge.color)}>
                                {r.score}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-0.5 text-xs font-medium',
                                delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-400'
                              )}>
                                {delta > 0 ? <ArrowUp className="h-3 w-3" /> : delta < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                {delta > 0 ? '+' : ''}{delta}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize', icpBadge.color)}>
                                {r.icp_fit}
                              </span>
                            </td>
                            <td className="max-w-[200px] px-4 py-2.5 text-xs text-gray-500">
                              {r.reasoning.length > 80 ? r.reasoning.slice(0, 80) + '...' : r.reasoning}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Done message */}
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="text-sm text-green-700">
                    Scores have been applied to all {results.length} leads.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={onClose}
                    className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
