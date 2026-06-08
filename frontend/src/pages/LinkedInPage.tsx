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
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Linkedin className="h-4 w-4 text-white" />
            </div>
            LinkedIn Outreach
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Track AI-generated connection notes and follow-up messages per lead
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={MessageSquare} color="text-gray-700" bg="bg-gray-50" />
        <StatCard label="Sent" value={stats.sent} icon={MessageSquare} color="text-blue-700" bg="bg-blue-50" />
        <StatCard label="Connected" value={stats.connected} icon={UserCheck} color="text-indigo-700" bg="bg-indigo-50" />
        <StatCard label="Replied" value={stats.replied} icon={MessageCircle} color="text-green-700" bg="bg-green-50" suffix={stats.replied > 0 ? `${replyRate}% rate` : undefined} />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">Filter:</span>
        {[{ value: '', label: 'All' }, ...LINKEDIN_STATUSES.map((s) => ({ value: s.value, label: s.label }))].map(
          (opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === opt.value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:border-indigo-300'
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
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Connection Note</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Created</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
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
      <tr className="hover:bg-gray-50/60 transition-colors">
        {/* Lead */}
        <td className="px-4 py-3">
          <p className="font-medium text-gray-900 truncate max-w-[160px]">
            {msg.lead_company || '—'}
          </p>
          {msg.lead_contact && (
            <p className="text-xs text-gray-500 truncate max-w-[160px]">{msg.lead_contact}</p>
          )}
          {msg.lead_designation && (
            <p className="text-xs text-gray-400 truncate max-w-[160px]">{msg.lead_designation}</p>
          )}
        </td>

        {/* Note preview */}
        <td className="px-4 py-3">
          <p className="text-sm text-gray-700 line-clamp-2 max-w-[320px]">
            {msg.connection_note}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
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
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                meta.color
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {meta.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showStatusMenu && (
              <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                {nextStatuses.map((s) => (
                  <button
                    key={s.value}
                    disabled={isUpdating}
                    onClick={() => {
                      onStatusChange(msg, s.value)
                      setShowStatusMenu(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50"
                  >
                    <span className={cn('rounded-full px-2 py-0.5', s.color)}>{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </td>

        {/* Date */}
        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
          {formatDate(msg.created_at)}
        </td>

        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => copyText(msg.connection_note, 'note')}
              title="Copy connection note"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              {copied === 'note' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onToggle}
              title="Expand"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
            </button>
            <button
              onClick={onGoToLead}
              title="Go to lead"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(msg.id)}
              title="Delete"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-indigo-50/30">
          <td colSpan={5} className="px-6 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Connection note */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Connection Note ({msg.connection_note.length}/300)
                  </p>
                  <button
                    onClick={() => copyText(msg.connection_note, 'note')}
                    className="inline-flex items-center gap-1 rounded text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    {copied === 'note' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </button>
                </div>
                <p className="rounded-lg bg-white px-4 py-3 text-sm text-gray-800 leading-relaxed shadow-sm ring-1 ring-gray-200">
                  {msg.connection_note}
                </p>
              </div>

              {/* Follow-up message */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Follow-up Message
                  </p>
                  {msg.followup_message && (
                    <button
                      onClick={() => copyText(msg.followup_message!, 'followup')}
                      className="inline-flex items-center gap-1 rounded text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      {copied === 'followup' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy
                    </button>
                  )}
                </div>
                {msg.followup_message ? (
                  <p className="rounded-lg bg-white px-4 py-3 text-sm text-gray-800 leading-relaxed shadow-sm ring-1 ring-gray-200">
                    {msg.followup_message}
                  </p>
                ) : (
                  <p className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-400 italic">
                    No follow-up generated
                  </p>
                )}
              </div>
            </div>

            {/* Timeline chips */}
            {(msg.sent_at || msg.connected_at || msg.replied_at) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {msg.sent_at && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                    <MessageSquare className="h-3 w-3" /> Sent {formatDate(msg.sent_at)}
                  </span>
                )}
                {msg.connected_at && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                    <UserCheck className="h-3 w-3" /> Connected {formatDate(msg.connected_at)}
                  </span>
                )}
                {msg.replied_at && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs text-green-700">
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
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
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
  color,
  bg,
  suffix,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  suffix?: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', bg)}>
          <Icon className={cn('h-3.5 w-3.5', color)} />
        </div>
      </div>
      <p className={cn('mt-2 text-2xl font-bold', color)}>{value}</p>
      {suffix && <p className="mt-0.5 text-xs text-gray-400">{suffix}</p>}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onGoToLeads }: { onGoToLeads: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
        <Linkedin className="h-6 w-6 text-blue-600" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">No LinkedIn messages yet</h3>
      <p className="mt-1.5 max-w-sm text-sm text-gray-500">
        Open a lead and use the <strong>LinkedIn</strong> tab to generate AI-crafted connection
        notes and follow-up messages.
      </p>
      <button
        onClick={onGoToLeads}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <Sparkles className="h-4 w-4" />
        Go to Leads
      </button>
    </div>
  )
}
