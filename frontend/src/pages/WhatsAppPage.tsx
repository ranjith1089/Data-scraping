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
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        meta?.color ?? 'bg-gray-100 text-gray-500'
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
        className="hover:bg-gray-50 cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-4 py-3">
          <Link
            to={`/leads/${msg.lead_id}`}
            className="font-medium text-sm text-gray-900 hover:text-indigo-600"
            onClick={(e) => e.stopPropagation()}
          >
            {msg.lead_company ?? '—'}
          </Link>
          {msg.lead_contact && (
            <p className="text-xs text-gray-500 mt-0.5">{msg.lead_contact}</p>
          )}
        </td>

        <td className="px-4 py-3 max-w-xs">
          <p className="text-sm text-gray-700 truncate">{msg.content}</p>
        </td>

        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              msg.direction === 'inbound'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-blue-50 text-blue-700'
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

        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
          {timeAgo}
        </td>

        <td className="px-4 py-3 text-center">
          {open ? (
            <ChevronUp className="w-4 h-4 text-gray-400 mx-auto" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 mx-auto" />
          )}
        </td>
      </tr>

      {open && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="px-6 pb-4 pt-2">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed flex-1">
                {msg.content}
              </p>
              <button
                onClick={copy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 shrink-0"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Timeline chips */}
            <div className="flex flex-wrap gap-3 mt-3">
              {msg.phone_number && (
                <span className="text-xs text-gray-500">
                  📱 {msg.phone_number}
                </span>
              )}
              {msg.sent_at && (
                <span className="text-xs text-gray-500">
                  Sent {new Date(msg.sent_at).toLocaleString('en-IN')}
                </span>
              )}
              {msg.delivered_at && (
                <span className="text-xs text-gray-500">
                  Delivered {new Date(msg.delivered_at).toLocaleString('en-IN')}
                </span>
              )}
              {msg.read_at && (
                <span className="text-xs text-gray-500">
                  Read {new Date(msg.read_at).toLocaleString('en-IN')}
                </span>
              )}
              {msg.ai_tone && (
                <span className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full capitalize">
                  {msg.ai_tone} tone
                </span>
              )}
              {msg.error_message && (
                <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-md">
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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-green-500" />
            WhatsApp Outreach
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            AI-generated cold openers delivered via WhatsApp Cloud API
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total',     value: total,     color: 'text-gray-900' },
          { label: 'Sent',      value: sent,      color: 'text-blue-600' },
          { label: 'Delivered', value: delivered, color: 'text-indigo-600' },
          { label: 'Read',      value: read,      color: 'text-green-600' },
          { label: 'Replies',   value: `${inbound} (${replyRate}%)`, color: 'text-emerald-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            statusFilter === ''
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          All
        </button>
        {WA_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() =>
              setStatusFilter(statusFilter === s.value ? '' : s.value)
            }
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No messages yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Open a lead and use the WhatsApp tab to generate and send your first message.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Lead
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Direction
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {messages.map((msg) => (
                <MessageRow key={msg.id} msg={msg} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
