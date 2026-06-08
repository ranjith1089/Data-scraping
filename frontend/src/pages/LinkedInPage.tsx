import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Linkedin,
  Loader2,
  Sparkles,
  ChevronDown,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  UserCheck,
  MessageCircle,
  Clock,
  X,
  ChevronRight,
} from 'lucide-react'
import {
  useAllLinkedInMessages,
  useUpdateLinkedInMessage,
  useDeleteLinkedInMessage,
  LINKEDIN_STATUSES,
  type LinkedInMessage,
} from '@/hooks/useLinkedIn'
import { cn, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600',   icon: Clock },
  sent:      { label: 'Sent',      color: 'bg-blue-50 text-blue-700',    icon: MessageSquare },
  connected: { label: 'Connected', color: 'bg-indigo-50 text-indigo-700', icon: UserCheck },
  replied:   { label: 'Replied',   color: 'bg-green-50 text-green-700',  icon: MessageCircle },
  ignored:   { label: 'Ignored',   color: 'bg-red-50 text-red-500',      icon: X },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LinkedInPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: messages = [], isLoading, refetch } = useAllLinkedInMessages(
    statusFilter || undefined
  )
  const updateMutation = useUpdateLinkedInMessage()
  const deleteMutation = useDeleteLinkedInMessage()

  // Stats
  const stats = {
    total:     messages.length,
    sent:      messages.filter((m) => m.status === 'sent').length,
    connected: messages.filter((m) => m.status === 'connected').length,
    replied:   messages.filter((m) => m.status === 'replied').length,
  }
  const replyRate =
    stats.sent + stats.connected + stats.replied > 0
      ? Math.round((stats.replied / (stats.sent + stats.connected + stats.replied)) * 100)
      : 0

  async function handleStatusChange(msg: LinkedInMessage, newStatus: LinkedInMessage['status']) {
    const now = new Date().toISOString()
    const extra: Record<string, string> = {}
    if (newStatus === 'sent' && !msg.sent_at) extra.sent_at = now
    if (newStatus === 'connected' && !msg.connected_at) extra.connected_at = now
    if (newStatus === 'replied' && !msg.replied_at) extra.replied_at = now
    try {
      await updateMutation.mutateAsync({ id: msg.id, updates: { status: newStatus, ...extra } })
      toast.success(`Marked as ${STATUS_META[newStatus].label}`)
    } catch {
      toast.error('Failed to update status')
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this message? This cannot be undone.')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Message deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
              <Linkedin className="h-4 w-4 text-white" />
            </div>
            LinkedIn Outreach
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground ml-10">
            Track AI-generated connection notes and follow-up messages per lead
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-white px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={MessageSquare} gradient="from-slate-500 to-gray-600" />
        <StatCard label="Sent" value={stats.sent} icon={MessageSquare} gradient="from-blue-500 to-sky-500" />
        <StatCard label="Connected" value={stats.connected} icon={UserCheck} gradient="from-indigo-500 to-violet-600" />
        <StatCard label="Replied" value={stats.replied} icon={MessageCircle} gradient="from-emerald-500 to-teal-500" suffix={stats.replied > 0 ? `${replyRate}% rate` : undefined} />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {[{ value: '', label: 'All' }, ...LINKEDIN_STATUSES.map((s) => ({ value: s.value, label: s.label }))].map(
          (opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
                statusFilter === opt.value
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-sm'
                  : 'bg-white border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {opt.label}
            </button>
          )
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : messages.length === 0 ? (
        <EmptyState onGoToLeads={() => navigate('/leads')} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
          <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="border-b border-border/60 bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lead</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Connection Note</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Created</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {messages.map((msg) => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  expanded={expandedId === msg.id}
                  onToggle={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onGoToLead={() => navigate(`/leads/${msg.lead_id}`)}
                  isUpdating={updateMutation.isPending}
                />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Message row ──────────────────────────────────────────────────────────────

function MessageRow({
  msg,
  expanded,
  onToggle,
  onStatusChange,
  onDelete,
  onGoToLead,
  isUpdating,
}: {
  msg: LinkedInMessage
  expanded: boolean
  onToggle: () => void
  onStatusChange: (msg: LinkedInMessage, status: LinkedInMessage['status']) => void
  onDelete: (id: string) => void
  onGoToLead: () => void
  isUpdating: boolean
}) {
  const [copied, setCopied] = useState<'note' | 'followup' | null>(null)
  const [showStatusMenu, setShowStatusMenu] = useState(false)

  const meta = STATUS_META[msg.status] ?? STATUS_META.draft
  const StatusIcon = meta.icon

  function copyText(text: string, which: 'note' | 'followup') {
    navigator.clipboard.writeText(text)
    setCopied(which)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(null), 2000)
  }

  const nextStatuses = LINKEDIN_STATUSES.filter((s) => s.value !== msg.status)

  return (
    <>
      <tr className="hover:bg-muted/30 transition-colors">
        {/* Lead */}
        <td className="px-4 py-3">
          <p className="font-semibold text-foreground truncate max-w-[160px]">
            {msg.lead_company || '—'}
          </p>
          {msg.lead_contact && (
            <p className="text-xs text-muted-foreground truncate max-w-[160px]">{msg.lead_contact}</p>
          )}
          {msg.lead_designation && (
            <p className="text-xs text-muted-foreground/70 truncate max-w-[160px]">{msg.lead_designation}</p>
          )}
        </td>

        {/* Note preview */}
        <td className="px-4 py-3">
          <p className="text-sm text-foreground/80 line-clamp-2 max-w-[320px]">
            {msg.connection_note}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {msg.connection_note.length}/300 chars
            {msg.followup_message && ' · has follow-up'}
          </p>
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-all',
                meta.color
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {meta.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showStatusMenu && (
              <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-xl border border-border/60 bg-white py-1 shadow-lg">
                {nextStatuses.map((s) => (
                  <button
                    key={s.value}
                    disabled={isUpdating}
                    onClick={() => {
                      onStatusChange(msg, s.value)
                      setShowStatusMenu(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors"
                  >
                    <span className={cn('rounded-full px-2 py-0.5 ring-1 ring-inset', s.color)}>{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </td>

        {/* Date */}
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(msg.created_at)}
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => copyText(msg.connection_note, 'note')}
              title="Copy connection note"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              {copied === 'note' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onToggle}
              title="Expand"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
            </button>
            <button
              onClick={onGoToLead}
              title="Go to lead"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(msg.id)}
              title="Delete"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-500 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={5} className="px-6 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Connection note */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Connection Note ({msg.connection_note.length}/300)
                  </p>
                  <button
                    onClick={() => copyText(msg.connection_note, 'note')}
                    className="inline-flex items-center gap-1 rounded text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    {copied === 'note' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </button>
                </div>
                <p className="rounded-xl bg-white px-4 py-3 text-sm text-foreground/80 leading-relaxed shadow-sm ring-1 ring-border/60">
                  {msg.connection_note}
                </p>
              </div>

              {/* Follow-up message */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Follow-up Message
                  </p>
                  {msg.followup_message && (
                    <button
                      onClick={() => copyText(msg.followup_message!, 'followup')}
                      className="inline-flex items-center gap-1 rounded text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {copied === 'followup' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy
                    </button>
                  )}
                </div>
                {msg.followup_message ? (
                  <p className="rounded-xl bg-white px-4 py-3 text-sm text-foreground/80 leading-relaxed shadow-sm ring-1 ring-border/60">
                    {msg.followup_message}
                  </p>
                ) : (
                  <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground italic">
                    No follow-up generated
                  </p>
                )}
              </div>
            </div>

            {/* Timeline chips */}
            {(msg.sent_at || msg.connected_at || msg.replied_at) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {msg.sent_at && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                    <MessageSquare className="h-3 w-3" /> Sent {formatDate(msg.sent_at)}
                  </span>
                )}
                {msg.connected_at && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                    <UserCheck className="h-3 w-3" /> Connected {formatDate(msg.connected_at)}
                  </span>
                )}
                {msg.replied_at && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <MessageCircle className="h-3 w-3" /> Replied {formatDate(msg.replied_at)}
                  </span>
                )}
              </div>
            )}

            {/* LinkedIn link */}
            {msg.lead_linkedin_url && (
              <a
                href={msg.lead_linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                <Linkedin className="h-3.5 w-3.5" />
                Open LinkedIn Profile
              </a>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  gradient,
  suffix,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  gradient: string
  suffix?: string
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-border/60 bg-white p-4 shadow-sm card-lift')}>
      <div className={cn('absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r', gradient)} />
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm', gradient)}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-foreground">{value}</p>
      {suffix && <p className="mt-0.5 text-xs text-muted-foreground">{suffix}</p>}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onGoToLeads }: { onGoToLeads: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/30 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md mb-4">
        <Linkedin className="h-6 w-6 text-white" />
      </div>
      <h3 className="text-base font-bold text-foreground">No LinkedIn messages yet</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Open a lead and use the <strong>LinkedIn</strong> tab to generate AI-crafted connection
        notes and follow-up messages.
      </p>
      <button
        onClick={onGoToLeads}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-200 hover:opacity-90 hover:-translate-y-px transition-all"
      >
        <Sparkles className="h-4 w-4" />
        Go to Leads
      </button>
    </div>
  )
}
