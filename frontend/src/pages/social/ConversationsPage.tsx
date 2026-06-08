import { useState } from 'react'
import { Send, MessageSquare, UserPlus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useConversation,
  useConversations,
  usePromoteConversation,
  useSendManualMessage,
  useUpdateConversation,
  type Conversation,
} from '@/hooks/social/useConversations'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function ConversationsPage() {
  const [filter, setFilter] = useState<'all' | 'open' | 'snoozed' | 'closed'>('open')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const { data: conversations = [], isLoading } = useConversations({
    convo_status: filter === 'all' ? undefined : filter,
    q: search || undefined,
  })

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-7rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Conversations</h1>
        <p className="text-muted-foreground mt-1">
          Every Instagram DM thread, in one inbox.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* List pane */}
        <Card className="md:col-span-1 flex flex-col min-h-0">
          <CardContent className="p-3 space-y-2 border-b">
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-1 text-xs">
              {(['all', 'open', 'snoozed', 'closed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-2 py-1 rounded-md',
                    filter === f
                      ? 'bg-indigo-600 text-white'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </CardContent>
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading…</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <MessageSquare className="h-6 w-6 mx-auto opacity-30 mb-2" />
                Nothing here yet.
              </div>
            ) : (
              conversations.map((c) => (
                <ConvRow
                  key={c.id}
                  c={c}
                  active={selected === c.id}
                  onClick={() => setSelected(c.id)}
                />
              ))
            )}
          </div>
        </Card>

        {/* Thread pane */}
        <Card className="md:col-span-2 flex flex-col min-h-0">
          <ThreadPane id={selected} />
        </Card>
      </div>
    </div>
  )
}

function ConvRow({
  c,
  active,
  onClick,
}: {
  c: Conversation
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-3 border-b border-border/40 hover:bg-muted/40',
        active && 'bg-indigo-50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium truncate">
          {c.account.handle ? `@${c.account.handle}` : c.account.display_name || 'Unknown'}
        </p>
        {c.unread_count > 0 && (
          <span className="bg-indigo-600 text-white text-[10px] rounded-full px-1.5 py-0.5">
            {c.unread_count}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate mt-0.5">
        {c.last_message_preview || '—'}
      </p>
      <p className="text-[11px] text-muted-foreground/70 mt-0.5">
        {c.last_message_at
          ? new Date(c.last_message_at).toLocaleString()
          : 'No messages'}
      </p>
    </button>
  )
}

function ThreadPane({ id }: { id: string | null }) {
  const { data: convo, isLoading } = useConversation(id)
  const send = useSendManualMessage()
  const update = useUpdateConversation()
  const promote = usePromoteConversation()
  const [draft, setDraft] = useState('')

  if (!id) {
    return (
      <CardContent className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Pick a conversation to view it.
      </CardContent>
    )
  }
  if (isLoading || !convo) {
    return (
      <CardContent className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </CardContent>
    )
  }

  async function handleSend() {
    if (!id) return
    if (!draft.trim()) return
    try {
      await send.mutateAsync({ conversationId: id, content: draft.trim() })
      setDraft('')
    } catch {
      toast.error('Failed to send DM')
    }
  }

  async function handlePromote() {
    if (!id) return
    try {
      const r = await promote.mutateAsync({ id, sector_code: 'education' })
      toast.success(r.detail === 'merged' ? 'Tags merged onto existing lead.' : 'Lead created.')
    } catch {
      toast.error('Promote failed')
    }
  }

  return (
    <>
      <CardContent className="border-b p-3 flex items-center justify-between">
        <div>
          <p className="font-semibold">
            {convo.account.handle ? `@${convo.account.handle}` : convo.account.display_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {convo.platform} · {convo.status}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePromote}>
            <UserPlus className="h-3.5 w-3.5 mr-1" />
            {convo.account.lead_id ? 'Update lead' : 'Create lead'}
          </Button>
          {convo.status !== 'closed' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                update.mutate({ id, body: { status: 'closed' } })
              }
            >
              Close
            </Button>
          )}
        </div>
      </CardContent>

      <div className="overflow-y-auto flex-1 p-4 space-y-2 bg-muted/20">
        {convo.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-8">
            No messages yet.
          </p>
        ) : (
          convo.messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                m.direction === 'outbound'
                  ? 'ml-auto bg-indigo-600 text-white'
                  : 'mr-auto bg-white border border-border/60',
              )}
            >
              <p className="whitespace-pre-wrap break-words">{m.content || '(no content)'}</p>
              <p
                className={cn(
                  'text-[10px] mt-1',
                  m.direction === 'outbound' ? 'text-indigo-200' : 'text-muted-foreground/70',
                )}
              >
                {m.source} ·{' '}
                {new Date(m.created_at).toLocaleString()}
                {m.status !== 'received' && m.status !== 'sent' && ` · ${m.status}`}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Type a reply…"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <Button onClick={handleSend} disabled={send.isPending || !draft.trim()}>
            {send.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  )
}
