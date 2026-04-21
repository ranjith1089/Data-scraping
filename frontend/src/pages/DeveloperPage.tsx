import { useState } from 'react'
import {
  Key,
  Webhook,
  Plus,
  Trash2,
  Copy,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
} from '@/hooks/useApiKeys'
import {
  useWebhookSubscriptions,
  useCreateWebhookSubscription,
  useDeleteWebhookSubscription,
  useTestWebhookSubscription,
  type WebhookEventType,
} from '@/hooks/useWebhookSubscriptions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Tab = 'api-keys' | 'webhooks'

export default function DeveloperPage() {
  const [tab, setTab] = useState<Tab>('api-keys')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Developer</h1>
        <p className="text-muted-foreground mt-1">
          API keys for public REST access + outbound webhooks for Zapier / Make /
          custom integrations.
        </p>
      </div>

      <div className="inline-flex gap-1 rounded-lg border bg-background p-1 text-sm">
        <button
          onClick={() => setTab('api-keys')}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium transition-colors',
            tab === 'api-keys'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Key className="h-4 w-4" />
          API keys
        </button>
        <button
          onClick={() => setTab('webhooks')}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-3 py-1.5 font-medium transition-colors',
            tab === 'webhooks'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Webhook className="h-4 w-4" />
          Webhooks
        </button>
      </div>

      {tab === 'api-keys' ? <ApiKeysPanel /> : <WebhooksPanel />}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ApiKeysPanel() {
  const { data = [], isLoading } = useApiKeys()
  const createKey = useCreateApiKey()
  const deleteKey = useDeleteApiKey()
  const [name, setName] = useState('')
  const [lastCreated, setLastCreated] = useState<{ key: string; id: string } | null>(null)

  async function handleCreate() {
    if (!name.trim()) return
    try {
      const created = await createKey.mutateAsync(name.trim())
      setLastCreated({ key: created.key, id: created.id })
      setName('')
      toast.success('API key created')
    } catch {
      toast.error('Failed to create API key')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-1">Create a new API key</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Use the header{' '}
            <code className="bg-muted px-1 py-0.5 rounded">X-API-Key: lf_...</code>{' '}
            on <code>POST /api/v1/public/leads</code> and{' '}
            <code>GET /api/v1/public/leads/{'{id}'}</code>.
          </p>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Zapier integration"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={createKey.isPending || !name.trim()}>
              {createKey.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      {lastCreated && (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-900">
                Copy this key now — it won't be shown again.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-white px-2 py-1.5 text-xs font-mono border">
                {lastCreated.key}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(lastCreated.key)
                  toast.success('Copied')
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLastCreated(null)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : data.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No API keys yet.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {data.map((k) => (
            <Card key={k.id}>
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {k.preview}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used && ` · Last used ${new Date(k.last_used).toLocaleDateString()}`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!window.confirm('Revoke this key? Any integration using it will break.')) return
                    await deleteKey.mutateAsync(k.id)
                    toast.success('Key revoked')
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-600" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

const EVENT_OPTIONS: { value: WebhookEventType; label: string }[] = [
  { value: 'lead.created', label: 'Lead created' },
  { value: 'lead.updated', label: 'Lead updated' },
  { value: 'lead.stage_changed', label: 'Lead stage changed' },
]

function WebhooksPanel() {
  const { data = [], isLoading } = useWebhookSubscriptions()
  const createSub = useCreateWebhookSubscription()
  const deleteSub = useDeleteWebhookSubscription()
  const testSub = useTestWebhookSubscription()
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<WebhookEventType[]>(['lead.created'])
  const [lastCreated, setLastCreated] = useState<{ secret: string; id: string } | null>(null)

  async function handleCreate() {
    if (!url.trim() || events.length === 0) return
    try {
      const created = await createSub.mutateAsync({ url: url.trim(), event_types: events })
      setLastCreated({ secret: created.secret, id: created.id })
      setUrl('')
      toast.success('Webhook created')
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to create webhook')
    }
  }

  async function handleTest(id: string) {
    const result = await testSub.mutateAsync(id)
    if (result.ok) toast.success(`Ping delivered (HTTP ${result.status_code})`)
    else toast.error(result.error || `Failed (HTTP ${result.status_code})`)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-1">Create a new webhook</h3>
          <p className="text-xs text-muted-foreground mb-3">
            LeadForge POSTs JSON to this URL on the selected events. Signed with
            HMAC-SHA256 via <code>X-LeadForge-Signature</code>. Private /
            loopback hosts are rejected.
          </p>
          <div className="space-y-3">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
            />
            <div className="flex flex-wrap gap-2">
              {EVENT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() =>
                    setEvents((prev) =>
                      prev.includes(o.value)
                        ? prev.filter((e) => e !== o.value)
                        : [...prev, o.value],
                    )
                  }
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    events.includes(o.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Button
              onClick={handleCreate}
              disabled={createSub.isPending || !url.trim() || events.length === 0}
            >
              {createSub.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </div>
        </CardContent>
      </Card>

      {lastCreated && (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-900">
                HMAC secret — shown once, store it safely.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-white px-2 py-1.5 text-xs font-mono border">
                {lastCreated.secret}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(lastCreated.secret)
                  toast.success('Copied')
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setLastCreated(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : data.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No webhooks yet.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {data.map((sub) => (
            <Card key={sub.id}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <code className="text-xs break-all flex-1">{sub.url}</code>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(sub.id)}
                      disabled={testSub.isPending}
                    >
                      {testSub.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!window.confirm('Delete this webhook?')) return
                        await deleteSub.mutateAsync(sub.id)
                        toast.success('Webhook removed')
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-red-600" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sub.event_types.map((e) => (
                    <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
                  ))}
                </div>
                {sub.last_error && (
                  <div className="flex items-start gap-1.5 text-xs text-red-700 mt-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="break-all">
                      Last error: {sub.last_error}
                      {sub.failure_count > 0 && ` · ${sub.failure_count} failure(s)`}
                    </span>
                  </div>
                )}
                {sub.last_delivery_at && !sub.last_error && (
                  <p className="text-[11px] text-muted-foreground">
                    Last delivered {new Date(sub.last_delivery_at).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
