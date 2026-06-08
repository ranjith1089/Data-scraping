import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail,
  Plus,
  Play,
  Pause,
  Trash2,
  ChevronRight,
  Users,
  CheckCircle2,
  BarChart2,
  MessageSquare,
} from 'lucide-react'
import {
  useEmailSequences,
  useCreateSequence,
  useUpdateSequence,
  useDeleteSequence,
  SEQUENCE_STATUSES,
  type EmailSequence,
} from '@/hooks/useEmailSequences'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EmailSequence['status'] }) {
  const meta = SEQUENCE_STATUSES.find((s) => s.value === status)
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', meta?.color ?? 'bg-gray-100 text-gray-500')}>
      {meta?.label ?? status}
    </span>
  )
}

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const createMutation = useCreateSequence()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const seq = await createMutation.mutateAsync({ name: name.trim(), description: description.trim() || undefined })
      toast.success('Sequence created!')
      onClose()
      navigate(`/email-sequences/${seq.id}`)
    } catch {
      toast.error('Failed to create sequence')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border/60 px-6 py-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">New Email Sequence</h2>
            <p className="text-xs text-muted-foreground">Create a drip sequence — add steps after creation.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Sequence name *
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. IT Sector Cold Outreach"
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this sequence is for"
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border/60 px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {createMutation.isPending ? 'Creating…' : 'Create Sequence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Sequence card ────────────────────────────────────────────────────────────

function SequenceCard({ seq }: { seq: EmailSequence }) {
  const navigate = useNavigate()
  const updateMutation = useUpdateSequence(seq.id)
  const deleteMutation = useDeleteSequence()

  async function toggleStatus() {
    const next = seq.status === 'active' ? 'paused' : 'active'
    try {
      await updateMutation.mutateAsync({ status: next })
      toast.success(`Sequence ${next}`)
    } catch {
      toast.error('Failed to update status')
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${seq.name}"? This cannot be undone.`)) return
    try {
      await deleteMutation.mutateAsync(seq.id)
      toast.success('Deleted')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error'
      toast.error(msg.includes('draft') ? 'Only draft sequences can be deleted' : 'Delete failed')
    }
  }

  return (
    <div className="relative group rounded-2xl border border-border/60 bg-white p-5 shadow-sm card-lift overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-t-2xl" />
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3 mt-1">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => navigate(`/email-sequences/${seq.id}`)}
            className="text-left font-bold text-foreground hover:text-indigo-600 truncate block transition-colors"
          >
            {seq.name}
          </button>
          {seq.description && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{seq.description}</p>
          )}
        </div>
        <StatusBadge status={seq.status} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mb-4 bg-muted/40 rounded-xl p-3">
        {[
          { icon: <Mail className="w-3 h-3" />, label: 'Steps', value: seq.step_count },
          { icon: <Users className="w-3 h-3" />, label: 'Enrolled', value: seq.enrolled_count },
          { icon: <CheckCircle2 className="w-3 h-3" />, label: 'Done', value: seq.completed_count },
          { icon: <MessageSquare className="w-3 h-3" />, label: 'Replies', value: seq.reply_count },
        ].map(({ icon, label, value }) => (
          <div key={label} className="text-center">
            <p className="flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground mb-0.5">
              {icon} {label}
            </p>
            <p className="text-base font-extrabold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          {seq.status !== 'archived' && (
            <button
              onClick={toggleStatus}
              disabled={updateMutation.isPending || seq.status === 'draft'}
              title={seq.status === 'draft' ? 'Add steps first, then activate' : undefined}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-40',
                seq.status === 'active'
                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 ring-1 ring-amber-200'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-200'
              )}
            >
              {seq.status === 'active' ? (
                <><Pause className="w-3 h-3" /> Pause</>
              ) : (
                <><Play className="w-3 h-3" /> Activate</>
              )}
            </button>
          )}
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition-all"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        <button
          onClick={() => navigate(`/email-sequences/${seq.id}`)}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          Open <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailSequencesPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data: sequences = [], isLoading } = useEmailSequences(statusFilter || undefined)

  const totalEnrolled = sequences.reduce((s, q) => s + q.enrolled_count, 0)
  const totalActive = sequences.reduce((s, q) => s + q.active_count, 0)
  const totalReplies = sequences.reduce((s, q) => s + q.reply_count, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <Mail className="w-4 h-4 text-white" />
            </div>
            Email Sequences
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 ml-10">
            Multi-step drip campaigns with delay-based scheduling and reply tracking
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-purple-200 hover:opacity-90 hover:-translate-y-px transition-all">
          <Plus className="w-4 h-4" />
          New Sequence
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Sequences',  value: sequences.length, gradient: 'from-indigo-500 to-violet-600', icon: <Mail className="w-4 h-4 text-white" /> },
          { label: 'Enrolled',   value: totalEnrolled,    gradient: 'from-blue-500 to-sky-500',      icon: <Users className="w-4 h-4 text-white" /> },
          { label: 'Active',     value: totalActive,      gradient: 'from-emerald-500 to-teal-500',  icon: <BarChart2 className="w-4 h-4 text-white" /> },
          { label: 'Replies',    value: totalReplies,     gradient: 'from-violet-500 to-purple-600', icon: <MessageSquare className="w-4 h-4 text-white" /> },
        ].map(({ label, value, gradient, icon }) => (
          <div key={label} className="relative overflow-hidden bg-white rounded-2xl border border-border/60 p-4 shadow-sm card-lift">
            <div className={cn('absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r', gradient)} />
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
              <div className={cn('w-7 h-7 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm', gradient)}>{icon}</div>
            </div>
            <p className="text-2xl font-extrabold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[{ value: '', label: 'All' }, ...SEQUENCE_STATUSES].map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all',
              statusFilter === s.value
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-sm'
                : 'bg-white text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sequences.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/30 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md mb-4">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <p className="font-bold text-foreground text-base">No sequences yet</p>
          <p className="text-muted-foreground text-sm mt-1 mb-5 max-w-xs">
            Create your first multi-step email sequence to start automating outreach.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-purple-200 hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" /> Create Sequence
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sequences.map((seq) => (
            <SequenceCard key={seq.id} seq={seq} />
          ))}
        </div>
      )}
    </div>
  )
}
