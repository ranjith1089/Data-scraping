import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckSquare, Plus, Trash2, RotateCcw, AlertTriangle,
  Calendar, Clock, CheckCheck, Loader2, X,
} from 'lucide-react'
import {
  useTasks, useTaskSummary, useCreateTask, useCompleteTask,
  useReopenTask, useDeleteTask, PRIORITY_META, TASK_TYPE_META,
  type Task, type CreateTaskRequest,
} from '@/hooks/useTasks'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, isPast, isToday } from 'date-fns'
import toast from 'react-hot-toast'

type FilterView = 'all' | 'today' | 'overdue' | 'week' | 'done'

// ── Create form ────────────────────────────────────────────────────────────────
function CreateTaskForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateTask()
  const [form, setForm] = useState<CreateTaskRequest>({ title: '', task_type: 'follow_up', priority: 'medium', due_date: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      await createMutation.mutateAsync({ ...form, due_date: form.due_date || undefined })
      toast.success('Task created')
      onClose()
    } catch { toast.error('Failed to create task') }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">New Task</h3>
        <button type="button" onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Title *</label>
        <input autoFocus required type="text" value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Follow up with prospect on proposal"
          className="w-full rounded-xl border border-border/60 bg-white px-3 py-2 text-sm focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Type</label>
          <select value={form.task_type}
            onChange={(e) => setForm((f) => ({ ...f, task_type: e.target.value as Task['task_type'] }))}
            className="w-full rounded-xl border border-border/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10">
            {Object.entries(TASK_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Priority</label>
          <select value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Task['priority'] }))}
            className="w-full rounded-xl border border-border/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10">
            {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Due date</label>
          <input type="datetime-local" value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            className="w-full rounded-xl border border-border/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Description</label>
        <textarea rows={2} value={form.description ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Optional notes..."
          className="w-full rounded-xl border border-border/60 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/10" />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={!form.title.trim() || createMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50 hover:opacity-90 transition-all">
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create Task
        </button>
        <button type="button" onClick={onClose}
          className="rounded-xl border border-border/60 bg-white px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-all">
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Task row ───────────────────────────────────────────────────────────────────
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
      'group flex items-start gap-3 rounded-2xl border p-4 transition-all',
      isDone || isCancelled
        ? 'border-border/40 bg-muted/20 opacity-60'
        : overdue
          ? 'border-rose-200 bg-rose-50/40 hover:border-rose-300'
          : 'border-border/60 bg-white hover:border-primary/30 hover:shadow-sm',
    )}>
      {/* Checkbox */}
      <button
        onClick={async () => {
          if (isDone) { await reopenMutation.mutateAsync(task.id); toast.success('Task reopened') }
          else { await completeMutation.mutateAsync(task.id); toast.success('✓ Task done!') }
        }}
        disabled={completeMutation.isPending || reopenMutation.isPending || isCancelled}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all',
          isDone
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-border hover:border-primary',
        )}>
        {isDone && <CheckCheck className="w-3 h-3" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className={cn('text-sm font-semibold leading-snug', isDone && 'line-through text-muted-foreground')}>
            {task.title}
          </span>
          <span className={cn('shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', priorityMeta.color)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', priorityMeta.dot)} />
            {priorityMeta.label}
          </span>
          {overdue && !isDone && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">
              <AlertTriangle className="w-2.5 h-2.5" /> Overdue
            </span>
          )}
          {dueToday && !overdue && !isDone && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              <Clock className="w-2.5 h-2.5" /> Today
            </span>
          )}
        </div>
        {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground/70">
          <span>{typeMeta.icon} {typeMeta.label}</span>
          {task.lead_company && (
            <Link to={`/leads/${task.lead_id}`} className="hover:text-primary truncate max-w-[140px]">
              🏢 {task.lead_company}
            </Link>
          )}
          {task.deal_title && (
            <Link to={`/deals/${task.deal_id}`} className="hover:text-primary truncate max-w-[140px]">
              💼 {task.deal_title}
            </Link>
          )}
          {dueDate && (
            <span className={cn(overdue && !isDone ? 'text-rose-500 font-semibold' : '')}>
              <Calendar className="w-3 h-3 inline mr-0.5" />
              {formatDistanceToNow(dueDate, { addSuffix: true })}
            </span>
          )}
          {isDone && task.completed_at && (
            <span className="text-emerald-600 font-medium">
              ✓ Completed {formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {isDone && (
          <button onClick={async () => { await reopenMutation.mutateAsync(task.id); toast.success('Task reopened') }}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all" title="Reopen">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={async () => {
            if (!window.confirm('Delete this task?')) return
            await deleteMutation.mutateAsync(task.id); toast.success('Task deleted')
          }}
          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-500 transition-all" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
const FILTER_VIEWS: { key: FilterView; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'today',   label: 'Due Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'week',    label: 'This Week' },
  { key: 'done',    label: 'Completed' },
]

const SUMMARY_CONFIG = [
  { key: 'pending',      label: 'Pending',     gradient: 'from-slate-500 to-slate-600' },
  { key: 'in_progress',  label: 'In Progress', gradient: 'from-blue-500 to-indigo-600' },
  { key: 'overdue',      label: 'Overdue',     gradient: 'from-rose-500 to-pink-600' },
  { key: 'due_today',    label: 'Due Today',   gradient: 'from-amber-500 to-orange-500' },
  { key: 'due_this_week',label: 'This Week',   gradient: 'from-violet-500 to-purple-600' },
  { key: 'done',         label: 'Done Total',  gradient: 'from-emerald-500 to-teal-500' },
]

export default function TasksPage() {
  const [view, setView] = useState<FilterView>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<string>('')

  const { data: summary } = useTaskSummary()
  const { data: tasks = [], isLoading } = useTasks({
    status:    view === 'done' ? 'done' : undefined,
    overdue:   view === 'overdue',
    due_today: view === 'today',
    priority:  priorityFilter || undefined,
  })

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
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
              <CheckSquare className="w-4 h-4 text-white" />
            </div>
            Tasks & Follow-ups
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 ml-10">Track calls, emails, meetings, and follow-ups.</p>
        </div>
        <button onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-indigo-200 hover:opacity-90 hover:-translate-y-px transition-all">
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {SUMMARY_CONFIG.map((s) => {
            const value = summary[s.key as keyof typeof summary] as number
            return (
              <div key={s.key} className="relative overflow-hidden rounded-2xl bg-white border border-border/60 shadow-sm p-3 text-center card-lift">
                <div className={cn('absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r', s.gradient)} />
                <p className={cn(
                  'text-2xl font-extrabold mt-0.5',
                  (s.key === 'overdue' && value > 0) ? 'text-rose-600'
                  : (s.key === 'due_today' && value > 0) ? 'text-amber-600'
                  : 'text-foreground',
                )}>{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Create form */}
      {showCreate && <CreateTaskForm onClose={() => setShowCreate(false)} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-0.5 rounded-xl border border-border/60 bg-white p-1 shadow-sm">
          {FILTER_VIEWS.map((f) => (
            <button key={f.key} onClick={() => setView(f.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                view === f.key
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}>
              {f.label}
              {f.key === 'overdue' && summary && summary.overdue > 0 && (
                <span className="ml-1.5 rounded-full bg-rose-500 text-white px-1.5 py-0.5 text-[9px] font-bold">
                  {summary.overdue}
                </span>
              )}
              {f.key === 'today' && summary && summary.due_today > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 text-white px-1.5 py-0.5 text-[9px] font-bold">
                  {summary.due_today}
                </span>
              )}
            </button>
          ))}
        </div>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-xl border border-border/60 bg-white px-3 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/10 shadow-sm">
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
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            <CheckSquare className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">
            {view === 'overdue' ? 'No overdue tasks — great work! 🎉' :
             view === 'today'   ? 'Nothing due today.' :
             view === 'done'    ? 'No completed tasks yet.' :
             'No tasks yet. Click "New Task" to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => <TaskRow key={t.id} task={t} />)}
          <p className="text-xs text-muted-foreground text-right pt-1">
            {filtered.length} task{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
