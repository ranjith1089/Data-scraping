import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  Plus,
  Trash2,
  Clock,
  Play,
  Pause,
  Users,
  CheckCircle2,
  MessageSquare,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Save,
  X,
} from 'lucide-react'
import {
  useEmailSequenceDetail,
  useUpdateSequence,
  useAddStep,
  useUpdateStep,
  useDeleteStep,
  useSequenceEnrollments,
  useSequenceStats,
  useUpdateEnrollment,
  ENROLLMENT_STATUSES,
  EMAIL_TYPES,
  AI_TONES,
  type SequenceStep,
} from '@/hooks/useEmailSequences'
import { cn, formatDate } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

// ─── Step editor ─────────────────────────────────────────────────────────────

interface StepFormState {
  step_order: number
  delay_days: number
  subject: string
  body: string
  email_type: string
  ai_tone: string
}

const BLANK_STEP: StepFormState = {
  step_order: 1,
  delay_days: 0,
  subject: '',
  body: '',
  email_type: 'follow_up',
  ai_tone: 'professional',
}

function StepCard({
  step,
  seqId,
  isLast,
}: {
  step: SequenceStep
  seqId: string
  isLast: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<StepFormState>({
    step_order: step.step_order,
    delay_days: step.delay_days,
    subject: step.subject,
    body: step.body,
    email_type: step.email_type,
    ai_tone: step.ai_tone,
  })
  const [expanded, setExpanded] = useState(false)
  const updateMutation = useUpdateStep(seqId)
  const deleteMutation = useDeleteStep(seqId)

  async function handleSave() {
    try {
      await updateMutation.mutateAsync({ stepId: step.id, req: form })
      setEditing(false)
      toast.success('Step updated')
    } catch {
      toast.error('Failed to update step')
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this step?')) return
    try {
      await deleteMutation.mutateAsync(step.id)
      toast.success('Step deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="relative flex gap-4">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200" />
      )}

      {/* Step number circle */}
      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow">
        {step.step_order}
      </div>

      {/* Card */}
      <div className="flex-1 rounded-xl border border-gray-200 bg-white shadow-sm mb-4">
        {editing ? (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Step order</label>
                <input
                  type="number"
                  min={1}
                  value={form.step_order}
                  onChange={(e) => setForm((f) => ({ ...f, step_order: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Delay (days after prev)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.delay_days}
                  onChange={(e) => setForm((f) => ({ ...f, delay_days: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Use {{contact}}, {{company}}, {{designation}}"
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Body</label>
              <textarea
                rows={5}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Hi {{contact}}, ..."
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={form.email_type}
                  onChange={(e) => setForm((f) => ({ ...f, email_type: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {EMAIL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tone</label>
                <select
                  value={form.ai_tone}
                  onChange={(e) => setForm((f) => ({ ...f, ai_tone: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {AI_TONES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{step.subject}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {step.delay_days === 0
                      ? 'Immediately'
                      : `After ${step.delay_days} day${step.delay_days !== 1 ? 's' : ''}`}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 capitalize">
                    {EMAIL_TYPES.find((t) => t.value === step.email_type)?.label ?? step.email_type}
                  </span>
                  <span className="text-xs bg-indigo-50 text-indigo-600 rounded px-1.5 py-0.5 capitalize">
                    {step.ai_tone}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditing(true)}
                  className="rounded p-1.5 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setExpanded((o) => !o)}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
                >
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {expanded && (
              <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{step.body}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Add step panel ───────────────────────────────────────────────────────────

function AddStepPanel({ seqId, nextOrder }: { seqId: string; nextOrder: number }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<StepFormState>({ ...BLANK_STEP, step_order: nextOrder })
  const addMutation = useAddStep(seqId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.subject.trim() || !form.body.trim()) {
      toast.error('Subject and body are required')
      return
    }
    try {
      await addMutation.mutateAsync(form)
      setForm({ ...BLANK_STEP, step_order: nextOrder + 1 })
      setOpen(false)
      toast.success('Step added!')
    } catch {
      toast.error('Failed to add step')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full rounded-xl border-2 border-dashed border-gray-200 p-4 text-sm font-medium text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
      >
        <Plus className="w-4 h-4" /> Add Step {nextOrder}
      </button>
    )
  }

  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/30 p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">New Step {nextOrder}</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Step order</label>
            <input
              type="number" min={1}
              value={form.step_order}
              onChange={(e) => setForm((f) => ({ ...f, step_order: Number(e.target.value) }))}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Delay (days)</label>
            <input
              type="number" min={0}
              value={form.delay_days}
              onChange={(e) => setForm((f) => ({ ...f, delay_days: Number(e.target.value) }))}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="Quick question for {{company}}"
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Body</label>
          <textarea
            rows={5}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder={`Hi {{contact}},\n\nI wanted to follow up...\n\nBest,\n[Your name]`}
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">
            Available variables: <code>{'{{contact}}'}</code> <code>{'{{company}}'}</code> <code>{'{{designation}}'}</code>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              value={form.email_type}
              onChange={(e) => setForm((f) => ({ ...f, email_type: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            >
              {EMAIL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tone</label>
            <select
              value={form.ai_tone}
              onChange={(e) => setForm((f) => ({ ...f, ai_tone: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            >
              {AI_TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            {addMutation.isPending ? 'Adding…' : 'Add Step'}
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
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabKey = 'steps' | 'enrollments' | 'stats'

export default function EmailSequenceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabKey>('steps')

  const { data: seq, isLoading } = useEmailSequenceDetail(id || '')
  const { data: enrollments = [] } = useSequenceEnrollments(id || '')
  const { data: stats } = useSequenceStats(id || '')
  const updateSeqMutation = useUpdateSequence(id || '')
  const updateEnrollmentMutation = useUpdateEnrollment()

  if (isLoading || !seq) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  async function toggleStatus() {
    if (!seq) return
    const next = seq.status === 'active' ? 'paused' : 'active'
    try {
      await updateSeqMutation.mutateAsync({ status: next })
      toast.success(`Sequence ${next}`)
    } catch {
      toast.error('Failed to update')
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'steps', label: `Steps (${seq.step_count})` },
    { key: 'enrollments', label: `Enrollments (${seq.enrolled_count})` },
    { key: 'stats', label: 'Stats' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/email-sequences')}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Sequences
      </button>

      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{seq.name}</h1>
            {seq.description && <p className="text-sm text-gray-500 mt-0.5">{seq.description}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              seq.status === 'active' ? 'bg-green-50 text-green-700'
              : seq.status === 'paused' ? 'bg-amber-50 text-amber-700'
              : seq.status === 'draft' ? 'bg-gray-100 text-gray-600'
              : 'bg-red-50 text-red-400'
            )}>
              {seq.status}
            </span>
            {seq.status !== 'archived' && (
              <button
                onClick={toggleStatus}
                disabled={seq.status === 'draft' || updateSeqMutation.isPending}
                title={seq.status === 'draft' ? 'Add at least one step to activate' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40',
                  seq.status === 'active'
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                )}
              >
                {seq.status === 'active'
                  ? <><Pause className="w-3.5 h-3.5" /> Pause</>
                  : <><Play className="w-3.5 h-3.5" /> Activate</>
                }
              </button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-4 grid grid-cols-4 gap-4 border-t border-gray-100 pt-4">
          {[
            { icon: <Mail className="w-4 h-4 text-indigo-400" />, label: 'Steps', value: seq.step_count },
            { icon: <Users className="w-4 h-4 text-blue-400" />, label: 'Enrolled', value: seq.enrolled_count },
            { icon: <CheckCircle2 className="w-4 h-4 text-green-400" />, label: 'Completed', value: seq.completed_count },
            { icon: <MessageSquare className="w-4 h-4 text-violet-400" />, label: 'Replies', value: seq.reply_count },
          ].map(({ icon, label, value }) => (
            <div key={label} className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mb-1">
                {icon} {label}
              </div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'border-b-2 px-5 py-3 text-sm font-medium transition-colors',
                activeTab === t.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Steps tab */}
      {activeTab === 'steps' && (
        <div className="space-y-0">
          {seq.steps.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <Mail className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No steps yet. Add your first email below.</p>
            </div>
          )}
          {seq.steps.map((step, idx) => (
            <StepCard
              key={step.id}
              step={step}
              seqId={seq.id}
              isLast={idx === seq.steps.length - 1}
            />
          ))}
          <AddStepPanel seqId={seq.id} nextOrder={seq.step_count + 1} />
        </div>
      )}

      {/* Enrollments tab */}
      {activeTab === 'enrollments' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          {enrollments.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No leads enrolled yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Open a lead and use the Sequences tab to enroll them.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Step</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Next send</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Enrolled</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {enrollments.map((e) => {
                  const statusMeta = ENROLLMENT_STATUSES.find((s) => s.value === e.status)
                  return (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{e.lead_company ?? '—'}</p>
                        {e.lead_contact && <p className="text-xs text-gray-500">{e.lead_contact}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{e.lead_email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusMeta?.color ?? 'bg-gray-100 text-gray-500')}>
                          {statusMeta?.label ?? e.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{e.current_step} / {seq.step_count}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {e.next_step_at
                          ? formatDistanceToNow(new Date(e.next_step_at), { addSuffix: true })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(e.enrolled_at)}</td>
                      <td className="px-4 py-3">
                        {e.status === 'active' && (
                          <button
                            onClick={async () => {
                              await updateEnrollmentMutation.mutateAsync({ enrollmentId: e.id, status: 'paused' })
                              toast.success('Paused')
                            }}
                            className="text-xs text-amber-600 hover:text-amber-800"
                          >
                            Pause
                          </button>
                        )}
                        {e.status === 'paused' && (
                          <button
                            onClick={async () => {
                              await updateEnrollmentMutation.mutateAsync({ enrollmentId: e.id, status: 'active' })
                              toast.success('Resumed')
                            }}
                            className="text-xs text-green-600 hover:text-green-800"
                          >
                            Resume
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Stats tab */}
      {activeTab === 'stats' && (
        <div className="space-y-5">
          {/* Top-level metrics */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total sent', value: stats.total_sent, color: 'text-gray-900' },
                { label: 'Opened', value: `${stats.total_opened} (${stats.overall_open_rate}%)`, color: 'text-blue-700' },
                { label: 'Replied', value: `${stats.total_replied} (${stats.overall_reply_rate}%)`, color: 'text-green-700' },
                { label: 'Unsubscribed', value: stats.unsubscribed, color: 'text-red-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Per-step breakdown */}
          {stats && stats.per_step.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  Per-Step Performance
                </h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Step</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Subject</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Sent</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Opened</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Open %</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Replied</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Reply %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.per_step.map((s) => (
                    <tr key={s.step_order} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-indigo-600">#{s.step_order}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{s.subject}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">{s.sent}</td>
                      <td className="px-4 py-3 text-sm text-right text-blue-700">{s.opened}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-blue-600">{s.open_rate}%</td>
                      <td className="px-4 py-3 text-sm text-right text-green-700">{s.replied}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-green-600">{s.reply_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
              <BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No stats yet — data appears once emails are sent.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
