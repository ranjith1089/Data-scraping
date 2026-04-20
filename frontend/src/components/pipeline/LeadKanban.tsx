import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Briefcase, Mail, Phone, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLeads, useUpdateLead, type Lead } from '@/hooks/useLeads'
import { cn, STAGE_LABELS } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Lead-based Kanban for /pipeline. Columns are the seven canonical lead
 * stages (new → contacted → engaged → demo → proposal → negotiation →
 * won). Cards are draggable between columns via the HTML5 drag-and-drop
 * API (no extra library); dropping a card PATCHes the lead with the new
 * stage. Lost leads are rendered in a separate collapsed column at the
 * end so they don't pollute the active pipeline view.
 */

// The funnel displays a slightly different ordering (engaged before
// negotiation) — the Kanban uses the same canonical stage order as
// LeadDrawer so the two views agree.
const KANBAN_STAGES = [
  'new',
  'contacted',
  'engaged',
  'demo',
  'proposal',
  'negotiation',
  'won',
] as const

const STAGE_ACCENT: Record<string, { border: string; bg: string; dot: string }> = {
  new: { border: 'border-slate-300', bg: 'bg-slate-50', dot: 'bg-slate-400' },
  contacted: { border: 'border-blue-300', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  engaged: { border: 'border-violet-300', bg: 'bg-violet-50', dot: 'bg-violet-500' },
  demo: { border: 'border-amber-300', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  proposal: { border: 'border-orange-300', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  negotiation: { border: 'border-red-300', bg: 'bg-red-50', dot: 'bg-red-500' },
  won: { border: 'border-emerald-300', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  lost: { border: 'border-gray-300', bg: 'bg-gray-100', dot: 'bg-gray-400' },
}

// Pull a big slice on page-load so all seven stages are populated at
// once. 500 covers most single-tenant SMB pipelines; very large tenants
// can still click through to the Leads page for full filtering.
const KANBAN_PER_PAGE = 500

export default function LeadKanban() {
  const navigate = useNavigate()
  const updateLead = useUpdateLead()
  const { data, isLoading, refetch } = useLeads({ per_page: KANBAN_PER_PAGE })
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)

  const byStage = useMemo(() => {
    const groups: Record<string, Lead[]> = {}
    for (const stage of [...KANBAN_STAGES, 'lost']) {
      groups[stage] = []
    }
    for (const lead of data?.items ?? []) {
      const bucket = groups[lead.stage] ?? groups.new
      bucket.push(lead)
    }
    // Sort each column by lead_score desc so hottest leads float to the top.
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
    }
    return groups
  }, [data?.items])

  async function handleDrop(nextStage: string) {
    const id = draggedId
    setDraggedId(null)
    setOverStage(null)
    if (!id) return
    const current = (data?.items ?? []).find((l) => l.id === id)
    if (!current || current.stage === nextStage) return
    try {
      await updateLead.mutateAsync({ id, stage: nextStage })
      toast.success(`Moved to ${STAGE_LABELS[nextStage] ?? nextStage}`)
      refetch()
    } catch {
      toast.error('Failed to move lead')
    }
  }

  const allStages: readonly string[] = [...KANBAN_STAGES, 'lost']

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {allStages.map((stage) => {
          const leads = byStage[stage] ?? []
          const accent = STAGE_ACCENT[stage]
          const isOver = overStage === stage
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault()
                if (overStage !== stage) setOverStage(stage)
              }}
              onDragLeave={() => {
                if (overStage === stage) setOverStage(null)
              }}
              onDrop={() => handleDrop(stage)}
              className={cn(
                'flex h-[calc(100vh-20rem)] min-h-[500px] w-72 shrink-0 flex-col rounded-xl border-2 transition-colors',
                accent.border,
                isOver ? accent.bg : 'bg-white',
              )}
            >
              {/* Column header */}
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 rounded-full', accent.dot)} />
                  <h3 className="text-sm font-semibold text-gray-900">
                    {STAGE_LABELS[stage] ?? stage}
                  </h3>
                </div>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1.5 text-[11px] font-semibold text-gray-600">
                  {leads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))
                ) : leads.length === 0 ? (
                  <p className="mt-6 text-center text-xs text-gray-400">
                    Drop leads here
                  </p>
                ) : (
                  leads.map((lead) => (
                    <LeadKanbanCard
                      key={lead.id}
                      lead={lead}
                      isDragging={draggedId === lead.id}
                      onDragStart={() => setDraggedId(lead.id)}
                      onDragEnd={() => setDraggedId(null)}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Global "saving" indicator so the user knows a PATCH is in flight */}
      {updateLead.isPending && (
        <div className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating…
        </div>
      )}
    </div>
  )
}

function LeadKanbanCard({
  lead,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  lead: Lead
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onClick: () => void
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStart()
        e.dataTransfer.effectAllowed = 'move'
        // Firefox requires setData to initiate drag
        e.dataTransfer.setData('text/plain', lead.id)
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:border-indigo-200 hover:shadow active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="line-clamp-2 text-sm font-semibold text-gray-900">
          {lead.company_name}
        </h4>
        {(lead.lead_score ?? 0) > 0 && (
          <span className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
            <Zap className="h-2.5 w-2.5" />
            {lead.lead_score}
          </span>
        )}
      </div>

      {lead.contact_name && (
        <p className="mt-1 text-xs text-gray-600">{lead.contact_name}</p>
      )}

      <div className="mt-2 space-y-0.5">
        {lead.email && (
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <Mail className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <Phone className="h-2.5 w-2.5 flex-shrink-0" />
            <span>{lead.phone}</span>
          </div>
        )}
        {(lead.city || lead.district) && (
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <Briefcase className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">
              {[lead.city, lead.district].filter(Boolean).join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
