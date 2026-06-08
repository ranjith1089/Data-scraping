import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageCircle,
  Send,
  CheckCheck,
  Eye,
  ArrowDownLeft,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react'
import {
  useAllWhatsAppMessages,
  WA_STATUSES,
  type WhatsAppMessage,
} from '@/hooks/useWhatsApp'
import { formatDistanceToNow } from 'date-fns'

// ─── Status icon map ──────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:   <Clock className="w-3.5 h-3.5" />,
  sent:      <Send className="w-3.5 h-3.5" />,
  delivered: <CheckCheck className="w-3.5 h-3.5" />,
  read:      <Eye className="w-3.5 h-3.5" />,
  failed:    <XCircle className="w-3.5 h-3.5" />,
  received:  <ArrowDownLeft className="w-3.5 h-3.5" />,
}

function StatusBadge({ status }: { status: WhatsAppMessage['status'] }) {
  const meta = WA_STATUSES.find((s) => s.value === status)
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${
        meta?.color ?? 'bg-gray-100 text-gray-500 ring-gray-200'
      }`}
    >
      {STATUS_ICON[status] ?? null}
      {meta?.label ?? status}
    </span>
  )
}

// ─── Message row ─────────────────────────────────────────────────────────────

function MessageRow({ msg }: { msg: WhatsAppMessage }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const ts = msg.sent_at ?? msg.created_at
  const timeAgo = formatDistanceToNow(new Date(ts), { addSuffix: true })

  return (
    <>
      <tr
        className="hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-4 py-3">
          <Link
            to={`/leads/${msg.lead_id}`}
            className="font-semibold text-sm text-foreground hover:text-indigo-600 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {msg.lead_company ?? '—'}
          </Link>
          {msg.lead_contact && (
            <p className="text-xs text-muted-foreground mt-0.5">{msg.lead_contact}</p>
          )}
        </td>

        <td className="px-4 py-3 max-w-xs">
          <p className="text-sm text-foreground/80 truncate">{msg.content}</p>
        </td>

        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${
              msg.direction === 'inbound'
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-blue-50 text-blue-700 ring-blue-200'
            }`}
          >
            {msg.direction === 'inbound' ? (
              <ArrowDownLeft className="w-3 h-3" />
            ) : (
              <Send className="w-3 h-3" />
            )}
            {msg.direction}
          </span>
        </td>

        <td className="px-4 py-3">
          <StatusBadge status={msg.status} />
        </td>

        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          {timeAgo}
        </td>

        <td className="px-4 py-3 text-center">
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground mx-auto" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground mx-auto" />
          )}
        </td>
      </tr>

      {open && (
        <tr className="bg-muted/20">
          <td colSpan={6} className="px-6 pb-4 pt-2">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed flex-1 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-border/60">
                {msg.content}
              </p>
              <button
                onClick={copy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-border/60 bg-white hover:bg-muted text-muted-foreground hover:text-foreground transition-all shrink-0"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Timeline chips */}
            <div className="flex flex-wrap gap-2 mt-3">
              {msg.phone_number && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-inset ring-border/40">
                  📱 {msg.phone_number}
                </span>
              )}
              {msg.sent_at && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 ring-1 ring-inset ring-blue-200">
                  <Send className="w-3 h-3" /> Sent {new Date(msg.sent_at).toLocaleString('en-IN')}
                </span>
              )}
              {msg.delivered_at && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700 ring-1 ring-inset ring-indigo-200">
                  <CheckCheck className="w-3 h-3" /> Delivered {new Date(msg.delivered_at).toLocaleString('en-IN')}
                </span>
              )}
              {msg.read_at && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <Eye className="w-3 h-3" /> Read {new Date(msg.read_at).toLocaleString('en-IN')}
                </span>
              )}
              {msg.ai_tone && (
                <span className="inline-flex items-center rounded-full bg-violet-50 text-violet-600 px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-violet-200 capitalize">
                  {msg.ai_tone} tone
                </span>
              )}
              {msg.error_message && (
                <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-500 px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-rose-200">
                  ⚠ {msg.error_message}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data: messages = [], isLoading } = useAllWhatsAppMessages(
    statusFilter || undefined
  )

  // Stats
  const total = messages.length
  const sent = messages.filter(
    (m) => m.direction === 'outbound' && m.status !== 'pending' && m.status !== 'failed'
  ).length
  const delivered = messages.filter((m) => m.status === 'delivered' || m.status === 'read').length
  const read = messages.filter((m) => m.status === 'read').length
  const inbound = messages.filter((m) => m.direction === 'inbound').length
  const replyRate = sent > 0 ? Math.round((inbound / sent) * 100) : 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            WhatsApp Outreach
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 ml-10">
            AI-generated cold openers delivered via WhatsApp Cloud API
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total',     value: total,                      gradient: 'from-slate-500 to-gray-600',    icon: <MessageCircle className="w-3.5 h-3.5 text-white" /> },
          { label: 'Sent',      value: sent,                       gradient: 'from-blue-500 to-sky-500',      icon: <Send className="w-3.5 h-3.5 text-white" /> },
          { label: 'Delivered', value: delivered,                  gradient: 'from-indigo-500 to-violet-500', icon: <CheckCheck className="w-3.5 h-3.5 text-white" /> },
          { label: 'Read',      value: read,                       gradient: 'from-emerald-500 to-teal-500',  icon: <Eye className="w-3.5 h-3.5 text-white" /> },
          { label: 'Replies',   value: `${inbound} (${replyRate}%)`, gradient: 'from-green-500 to-emerald-600', icon: <ArrowDownLeft className="w-3.5 h-3.5 text-white" /> },
        ].map(({ label, value, gradient, icon }) => (
          <div key={label} className="relative overflow-hidden bg-white rounded-2xl border border-border/60 p-4 shadow-sm card-lift">
            <div className={`absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r ${gradient}`} />
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm ${gradient}`}>{icon}</div>
            </div>
            <p className="text-xl font-extrabold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            statusFilter === ''
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-sm'
              : 'bg-white text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted'
          }`}
        >
          All
        </button>
        {WA_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(statusFilter === s.value ? '' : s.value)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              statusFilter === s.value
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-sm'
                : 'bg-white text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-md mb-4">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <p className="font-bold text-foreground">No messages yet</p>
            <p className="text-muted-foreground text-sm mt-1 max-w-xs">
              Open a lead and use the WhatsApp tab to generate and send your first message.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[560px]">
            <thead className="bg-muted/40 border-b border-border/60">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Lead</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Message</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Direction</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Time</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {messages.map((msg) => (
                <MessageRow key={msg.id} msg={msg} />
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
