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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">New Email Sequence</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Create a drip sequence — add steps after creation.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sequence name *
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. IT Sector Cold Outreach"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this sequence is for"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
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
    <div className="group rounded-xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => navigate(`/email-sequences/${seq.id}`)}
            className="text-left font-semibold text-gray-900 hover:text-indigo-600 truncate block"
          >
            {seq.name}
          </button>
          {seq.description && (
            <p className="mt-0.5 text-xs text-gray-500 truncate">{seq.description}</p>
          )}
        </div>
        <StatusBadge status={seq.status} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { icon: <Mail className="w-3.5 h-3.5" />, label: 'Steps', value: seq.step_count },
          { icon: <Users className="w-3.5 h-3.5" />, label: 'Enrolled', value: seq.enrolled_count },
          { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Completed', value: seq.completed_count },
          { icon: <MessageSquare className="w-3.5 h-3.5" />, label: 'Replies', value: seq.reply_count },
        ].map(({ icon, label, value }) => (
          <div key={label} className="text-center">
            <p className="flex items-center justify-center gap-1 text-xs text-gray-400 mb-0.5">
              {icon} {label}
            </p>
            <p className="text-lg font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {seq.status !== 'archived' && (
            <button
              onClick={toggleStatus}
              disabled={updateMutation.isPending || seq.status === 'draft'}
              title={seq.status === 'draft' ? 'Add steps first, then activate' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
                seq.status === 'active'
                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
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
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        </div>
        <button
          onClick={() => navigate(`/email-sequences/${seq.id}`)}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-6 h-6 text-indigo-500" />
            Email Sequences
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Multi-step drip campaigns with delay-based scheduling and reply tracking
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          New Sequence
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Sequences',  value: sequences.length, color: 'text-gray-900',   icon: <Mail className="w-4 h-4 text-indigo-400" /> },
          { label: 'Enrolled',   value: totalEnrolled,    color: 'text-blue-700',   icon: <Users className="w-4 h-4 text-blue-400" /> },
          { label: 'Active',     value: totalActive,      color: 'text-green-700',  icon: <BarChart2 className="w-4 h-4 text-green-400" /> },
          { label: 'Replies',    value: totalReplies,     color: 'text-indigo-700', icon: <MessageSquare className="w-4 h-4 text-indigo-400" /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              {icon}
              <p className="text-xs text-gray-500">{label}</p>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
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
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              statusFilter === s.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
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
        <div className="text-center py-20">
          <Mail className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No sequences yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-4">
            Create your first multi-step email sequence to start automating outreach.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
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
