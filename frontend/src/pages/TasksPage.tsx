import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckSquare,
  Plus,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Calendar,
  Clock,
  CheckCheck,
  Loader2,
  X,
} from 'lucide-react'
import {
  useTasks,
  useTaskSummary,
  useCreateTask,
  useCompleteTask,
  useReopenTask,
  useDeleteTask,
  PRIORITY_META,
  TASK_TYPE_META,
  type Task,
  type CreateTaskRequest,
} from '@/hooks/useTasks'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, isPast, isToday } from 'date-fns'
import toast from 'react-hot-toast'

// ─── Types for filters ────────────────────────────────────────────────────────

type FilterView = 'all' | 'today' | 'overdue' | 'week' | 'done'

// ─── Create task form ─────────────────────────────────────────────────────────

function CreateTaskForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateTask()
  const [form, setForm] = useState<CreateTaskRequest>({
    title: '',
    task_type: 'follow_up',
    priority: 'medium',
    due_date: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      await createMutation.mutateAsync({
        ...form,
        due_date: form.due_date || undefined,
      })
      toast.success('Task created')
      onClose()
    } catch {
      toast.error('Failed to create task')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-gray-800">New Task</h3>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
        <input
          autoFocus required
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Follow up with Ranjith on proposal"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={form.task_type}
            onChange={(e) => setForm((f) => ({ ...f, task_type: e.target.value as Task['task_type'] }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {Object.entries(TASK_TYPE_META).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Task['priority'] }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {Object.entries(PRIORITY_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Due date</label>
          <input
            type="datetime-local"
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <textarea
          rows={2}
          value={form.description ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Optional notes..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={!form.title.trim() || createMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create Task
        </button>
        <button type="button" onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: Task }) {
  const completeMutation = useCompleteTask()
  const reopenMutation   = useReopenTask()
  const deleteMutation   = useDeleteTask()

  const isDone      = task.status === 'done'
  const isCancelled = task.status === 'cancelled'
  const priorityMeta = PRIORITY_META[task.priority] ?? PRIORITY_META.medium
  const typeMeta     = TASK_TYPE_META[task.task_type] ?? TASK_TYPE_META.other

  const dueDate = task.due_date ? new Date(task.due_date) : null
  const overdue  = task.is_overdue
  const dueToday = dueDate ? isToday(dueDate) : false

  return (
    <div className={cn(
      'group flex items-start gap-3 rounded-xl border p-4 transition-colors',
      isDone || isCancelled
        ? 'border-gray-100 bg-gray-50/50 opacity-60'
        : overdue
          ? 'border-red-200 bg-red-50/30'
          : 'border-gray-200 bg-white hover:border-indigo-200'
    )}>
      {/* Complete checkbox */}
      <button
        onClick={async () => {
          if (isDone) {
            await reopenMutation.mutateAsync(task.id)
            toast.success('Task reopened')
          } else {
            await completeMutation.mutateAsync(task.id)
            toast.success('✓ Task done!')
          }
        }}
        disabled={completeMutation.isPending || reopenMutation.isPending || isCancelled}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
          isDone
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-gray-300 hover:border-indigo-500'
        )}
      >
        {isDone && <CheckCheck className="w-3 h-3" />}
      </button>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className={cn('text-sm font-medium leading-snug', isDone && 'line-through text-gray-400')}>
            {task.title}
          </span>
          {/* Priority badge */}
          <span className={cn('shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', priorityMeta.color)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', priorityMeta.dot)} />
            {priorityMeta.label}
          </span>
          {overdue && !isDone && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">
              <AlertTriangle className="w-2.5 h-2.5" /> Overdue
            </span>
          )}
          {dueToday && !overdue && !isDone && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              <Clock className="w-2.5 h-2.5" /> Today
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-gray-400">
          <span>{typeMeta.icon} {typeMeta.label}</span>
          {task.lead_company && (
            <Link to={`/leads/${task.lead_id}`} className="hover:text-indigo-500 truncate max-w-[140px]">
              🏢 {task.lead_company}
            </Link>
          )}
          {task.deal_title && (
            <Link to={`/deals/${task.deal_id}`} className="hover:text-indigo-500 truncate max-w-[140px]">
              💼 {task.deal_title}
            </Link>
          )}
          {dueDate && (
            <span className={cn(overdue && !isDone ? 'text-red-400 font-medium' : '')}>
              <Calendar className="w-3 h-3 inline mr-0.5" />
              {formatDistanceToNow(dueDate, { addSuffix: true })}
            </span>
          )}
          {isDone && task.completed_at && (
            <span className="text-green-500">
              ✓ Completed {formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {isDone && (
          <button
            onClick={async () => { await reopenMutation.mutateAsync(task.id); toast.success('Task reopened') }}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Reopen"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={async () => {
            if (!window.confirm('Delete this task?')) return
            await deleteMutation.mutateAsync(task.id)
            toast.success('Task deleted')
          }}
          className="rounded p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-400"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FILTER_VIEWS: { key: FilterView; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'today',   label: 'Due Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'week',    label: 'This Week' },
  { key: 'done',    label: 'Completed' },
]

export default function TasksPage() {
  const [view, setView] = useState<FilterView>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<string>('')

  const { data: summary } = useTaskSummary()
  const { data: tasks = [], isLoading } = useTasks({
    status:    view === 'done'    ? 'done'    : view === 'all' ? undefined : undefined,
    overdue:   view === 'overdue',
    due_today: view === 'today',
    priority:  priorityFilter || undefined,
  })

  // Client-side filter for "week" view and done status
  const filtered = tasks.filter((t) => {
    if (view === 'done') return t.status === 'done'
    if (view === 'week') {
      if (t.status === 'done' || t.status === 'cancelled') return false
      if (!t.due_date) return false
      const due = new Date(t.due_date)
      const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7)
      return due <= weekEnd && !isPast(due)
    }
    if (view === 'all') return t.status !== 'done' && t.status !== 'cancelled'
    return true
  })

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-indigo-500" /> Tasks & Follow-ups
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track calls, emails, meetings, and follow-ups.</p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: 'Pending',    value: summary.pending,       color: 'text-gray-700' },
            { label: 'In Progress',value: summary.in_progress,   color: 'text-blue-600' },
            { label: 'Overdue',    value: summary.overdue,       color: summary.overdue > 0 ? 'text-red-600' : 'text-gray-500' },
            { label: 'Due Today',  value: summary.due_today,     color: summary.due_today > 0 ? 'text-amber-600' : 'text-gray-500' },
            { label: 'This Week',  value: summary.due_this_week, color: 'text-indigo-600' },
            { label: 'Done Total', value: summary.done,          color: 'text-green-600' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-center">
              <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && <CreateTaskForm onClose={() => setShowCreate(false)} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {FILTER_VIEWS.map((f) => (
            <button
              key={f.key}
              onClick={() => setView(f.key)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                view === f.key
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {f.label}
              {f.key === 'overdue' && summary && summary.overdue > 0 && (
                <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">
                  {summary.overdue}
                </span>
              )}
              {f.key === 'today' && summary && summary.due_today > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                  {summary.due_today}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600"
        >
          <option value="">All priorities</option>
          <option value="urgent">🔴 Urgent</option>
          <option value="high">🟠 High</option>
          <option value="medium">🔵 Medium</option>
          <option value="low">⚪ Low</option>
        </select>
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <CheckSquare className="mx-auto h-10 w-10 text-gray-200" />
          <p className="mt-3 text-sm font-medium text-gray-500">
            {view === 'overdue' ? 'No overdue tasks — great work!' :
             view === 'today'   ? 'Nothing due today.' :
             view === 'done'    ? 'No completed tasks yet.' :
             'No tasks yet. Click "New Task" to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => <TaskRow key={t.id} task={t} />)}
          <p className="text-xs text-gray-400 text-right pt-1">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  )
}
