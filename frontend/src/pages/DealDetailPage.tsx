import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  IndianRupee,
  Calendar,
  Target,
  Trophy,
  XCircle,
  RotateCcw,
  Trash2,
  Plus,
  PhoneCall,
  Mail,
  Users,
  FileText,
  Loader2,
  Edit3,
  Save,
  X,
} from 'lucide-react'
import {
  useDeal,
  useDealActivities,
  useUpdateDeal,
  useMarkWon,
  useMarkLost,
  useReopenDeal,
  useDeleteDeal,
  useAddDealActivity,
  useDeleteDealActivity,
  DEAL_STATUS_META,
  ACTIVITY_TYPE_META,
  type DealActivity,
} from '@/hooks/usePipelineDeals'
import { cn, formatINR, formatDate } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

// ─── Activity item ────────────────────────────────────────────────────────────

function ActivityItem({
  activity,
  dealId,
}: {
  activity: DealActivity
  dealId: string
}) {
  const deleteMutation = useDeleteDealActivity(dealId)
  const meta = ACTIVITY_TYPE_META[activity.activity_type] ?? { label: activity.activity_type, icon: '📌' }

  return (
    <div className="flex items-start gap-3 group">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm">
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {activity.content}
          </p>
          <button
            onClick={async () => {
              await deleteMutation.mutateAsync(activity.id)
            }}
            className="shrink-0 rounded p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-400 transition-opacity"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {meta.label} · {formatDistanceToNow(new Date(activity.occurred_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
}

// ─── Add activity form ────────────────────────────────────────────────────────

const ACTIVITY_TYPES = [
  { value: 'note',    label: 'Note',    icon: <FileText className="w-3.5 h-3.5" /> },
  { value: 'call',    label: 'Call',    icon: <PhoneCall className="w-3.5 h-3.5" /> },
  { value: 'email',   label: 'Email',   icon: <Mail className="w-3.5 h-3.5" /> },
  { value: 'meeting', label: 'Meeting', icon: <Users className="w-3.5 h-3.5" /> },
] as const

function AddActivityForm({ dealId }: { dealId: string }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'note' | 'call' | 'email' | 'meeting'>('note')
  const [content, setContent] = useState('')
  const addMutation = useAddDealActivity(dealId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    try {
      await addMutation.mutateAsync({ activity_type: type, content: content.trim() })
      setContent('')
      setOpen(false)
    } catch {
      toast.error('Failed to add activity')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 w-full transition-colors"
      >
        <Plus className="w-4 h-4" /> Log activity
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
      {/* Type chips */}
      <div className="flex gap-2 flex-wrap">
        {ACTIVITY_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              type === t.value
                ? 'border-indigo-500 bg-indigo-100 text-indigo-700'
                : 'border-gray-200 text-gray-600 hover:border-indigo-300'
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          type === 'call' ? 'What was discussed on the call?'
          : type === 'email' ? 'Summary of the email...'
          : type === 'meeting' ? 'Meeting notes...'
          : 'Add a note...'
        }
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!content.trim() || addMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Edit form ────────────────────────────────────────────────────────────────

function EditDealForm({
  deal,
  onClose,
}: {
  deal: ReturnType<typeof useDeal>['data']
  onClose: () => void
}) {
  const updateMutation = useUpdateDeal(deal?.id ?? '')
  const [form, setForm] = useState({
    title: deal?.title ?? '',
    value_inr: deal?.value_inr?.toString() ?? '',
    probability: deal?.probability?.toString() ?? '20',
    close_date: deal?.close_date ?? '',
    notes: deal?.notes ?? '',
  })

  if (!deal) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await updateMutation.mutateAsync({
        title: form.title,
        value_inr: form.value_inr ? Number(form.value_inr) : undefined,
        probability: form.probability ? Number(form.probability) : undefined,
        close_date: form.close_date || undefined,
        notes: form.notes || undefined,
      })
      toast.success('Deal updated')
      onClose()
    } catch {
      toast.error('Failed to update deal')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border border-gray-200 rounded-xl bg-gray-50">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Value (₹)</label>
          <input
            type="number" min={0}
            value={form.value_inr}
            onChange={(e) => setForm((f) => ({ ...f, value_inr: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Probability (%)</label>
          <input
            type="number" min={0} max={100}
            value={form.probability}
            onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Close date</label>
        <input
          type="date"
          value={form.close_date}
          onChange={(e) => setForm((f) => ({ ...f, close_date: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" /> Save
        </button>
        <button type="button" onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [showLostModal, setShowLostModal] = useState(false)
  const [lostReason, setLostReason] = useState('')

  const { data: deal, isLoading } = useDeal(id ?? '')
  const { data: activities = [] } = useDealActivities(id ?? '')
  const markWon = useMarkWon()
  const markLost = useMarkLost()
  const reopen = useReopenDeal()
  const deleteDeal = useDeleteDeal()

  if (isLoading || !deal) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
      </div>
    )
  }

  const statusMeta = DEAL_STATUS_META[deal.status] ?? DEAL_STATUS_META.open
  const weighted = ((deal.value_inr ?? 0) * (deal.probability ?? 0)) / 100

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate('/pipeline')}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Pipeline
      </button>

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900 truncate">{deal.title}</h1>
              <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', statusMeta.color)}>
                {statusMeta.label}
              </span>
            </div>
            {deal.lead_company && (
              <Link
                to={`/leads/${deal.lead_id}`}
                className="text-sm text-indigo-600 hover:underline"
              >
                {deal.lead_company}
                {deal.lead_contact && ` · ${deal.lead_contact}`}
              </Link>
            )}
            {deal.stage_name && (
              <p className="text-xs text-gray-400 mt-0.5">Stage: {deal.stage_name}</p>
            )}
          </div>

          <button
            onClick={() => setEditing((e) => !e)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
        </div>

        {editing && <EditDealForm deal={deal} onClose={() => setEditing(false)} />}

        {/* Metrics strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">
              <IndianRupee className="w-3 h-3" /> Deal value
            </p>
            <p className="text-lg font-bold text-gray-900">{formatINR(deal.value_inr ?? 0)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">
              <Target className="w-3 h-3" /> Probability
            </p>
            <p className="text-lg font-bold text-gray-900">{deal.probability ?? 0}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">Weighted value</p>
            <p className="text-lg font-bold text-indigo-600">{formatINR(weighted)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">
              <Calendar className="w-3 h-3" /> Close date
            </p>
            <p className={cn(
              'text-sm font-semibold',
              deal.close_date && new Date(deal.close_date) < new Date() && deal.status === 'open'
                ? 'text-red-500'
                : 'text-gray-900'
            )}>
              {deal.close_date
                ? new Date(deal.close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
            </p>
          </div>
        </div>

        {deal.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{deal.notes}</p>
          </div>
        )}

        {deal.lost_reason && deal.status === 'lost' && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
            <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{deal.lost_reason}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-5 flex flex-wrap gap-2">
          {deal.status === 'open' && (
            <>
              <button
                onClick={async () => {
                  await markWon.mutateAsync(deal.id)
                  toast.success('🎉 Deal won!')
                }}
                disabled={markWon.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Trophy className="w-4 h-4" /> Mark Won
              </button>
              <button
                onClick={() => setShowLostModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
              >
                <XCircle className="w-4 h-4" /> Mark Lost
              </button>
            </>
          )}
          {(deal.status === 'won' || deal.status === 'lost') && (
            <button
              onClick={async () => {
                await reopen.mutateAsync(deal.id)
                toast.success('Deal reopened')
              }}
              disabled={reopen.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" /> Reopen
            </button>
          )}
          <button
            onClick={async () => {
              if (!window.confirm('Delete this deal? This cannot be undone.')) return
              await deleteDeal.mutateAsync(deal.id)
              toast.success('Deal deleted')
              navigate('/pipeline')
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Mark Lost modal */}
      {showLostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Mark Deal as Lost</h3>
            <textarea
              rows={3}
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="Optional: why did this deal fall through?"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  await markLost.mutateAsync({ id: deal.id, lost_reason: lostReason || undefined })
                  toast.success('Deal marked as lost')
                  setShowLostModal(false)
                  setLostReason('')
                }}
                disabled={markLost.isPending}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {markLost.isPending ? 'Saving…' : 'Confirm Lost'}
              </button>
              <button
                onClick={() => setShowLostModal(false)}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity timeline */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Activity Timeline</h3>
        <div className="space-y-4 mb-4">
          {activities.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No activities yet. Log a call, email or note below.</p>
          ) : (
            activities.map((a) => (
              <ActivityItem key={a.id} activity={a} dealId={deal.id} />
            ))
          )}
        </div>
        <AddActivityForm dealId={deal.id} />
      </div>

      {/* Meta */}
      <div className="text-xs text-gray-400 text-right">
        Created {formatDate(deal.created_at)}
        {deal.updated_at && ` · Updated ${formatDate(deal.updated_at)}`}
      </div>
    </div>
  )
}
