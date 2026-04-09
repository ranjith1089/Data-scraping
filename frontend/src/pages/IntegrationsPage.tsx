import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Plug,
  Loader2,
  Search,
  Info,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import {
  cn,
  INTEGRATION_PROVIDERS,
  type IntegrationProviderMeta,
} from '@/lib/utils'
import {
  useIntegrations,
  useCreateIntegration,
  useDeleteIntegration,
  useTestIntegration,
  type Integration,
} from '@/hooks/useIntegrations'
import ProviderCard from '@/components/integrations/ProviderCard'

type CategoryFilter = 'all' | 'ads' | 'messaging' | 'email' | 'analytics'

const CATEGORIES: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ads', label: 'Ads Platforms' },
  { key: 'messaging', label: 'Messaging' },
  { key: 'email', label: 'Email' },
  { key: 'analytics', label: 'Analytics' },
]

/**
 * Integrations hub — standalone page at /integrations.
 *
 * Phase 1 scope: grid of all provider cards, status pills, Connect/Manage/Test
 * actions. Provider-specific config modals (Meta OAuth flow, WhatsApp template
 * picker, etc.) ship in later phases. For now, "Connect" creates an empty
 * integration row so the user can test the round-trip.
 */
export default function IntegrationsPage() {
  const { data: integrations = [], isLoading } = useIntegrations()
  const createMutation = useCreateIntegration()
  const deleteMutation = useDeleteIntegration()
  const testMutation = useTestIntegration()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [manageTarget, setManageTarget] = useState<Integration | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const byProvider = useMemo(() => {
    const map = new Map<string, Integration>()
    for (const integ of integrations) map.set(integ.provider, integ)
    return map
  }, [integrations])

  const filteredProviders = useMemo(() => {
    const q = search.trim().toLowerCase()
    return INTEGRATION_PROVIDERS.filter((p) => {
      if (category !== 'all' && p.category !== category) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.code.includes(q)
      )
    })
  }, [search, category])

  const stats = useMemo(() => {
    const connected = integrations.filter((i) => i.status === 'connected')
      .length
    const errored = integrations.filter((i) => i.status === 'error').length
    return {
      total: INTEGRATION_PROVIDERS.length,
      connected,
      errored,
    }
  }, [integrations])

  const handleConnect = async (meta: IntegrationProviderMeta) => {
    try {
      await createMutation.mutateAsync({
        provider: meta.code as Integration['provider'],
        display_name: meta.name,
      })
      toast.success(`${meta.name} integration created`)
    } catch (err) {
      toast.error(`Failed to create ${meta.name} integration`)
      // eslint-disable-next-line no-console
      console.error(err)
    }
  }

  const handleTest = async (integration: Integration, meta: IntegrationProviderMeta) => {
    setTestingId(integration.id)
    try {
      const result = await testMutation.mutateAsync(integration.id)
      if (result.ok) {
        toast.success(`${meta.name}: ${result.message}`)
      } else {
        toast.error(`${meta.name}: ${result.message}`)
      }
    } catch {
      toast.error(`Failed to test ${meta.name}`)
    } finally {
      setTestingId(null)
    }
  }

  const handleDisconnect = async (integration: Integration) => {
    try {
      await deleteMutation.mutateAsync(integration.id)
      toast.success('Integration removed')
      setManageTarget(null)
    } catch {
      toast.error('Failed to remove integration')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <Plug className="h-6 w-6 text-gray-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Connect LeadForge to your ad platforms, messaging and analytics
              tools.
            </p>
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex items-center gap-2">
          <StatPill
            label="Connected"
            value={`${stats.connected} / ${stats.total}`}
            tone="green"
          />
          {stats.errored > 0 && (
            <StatPill label="Errors" value={String(stats.errored)} tone="red" />
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategory(cat.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                category === cat.key
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Info banner for Phase 1 */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-medium text-blue-900">
            Phase 1 — foundation ready
          </p>
          <p className="mt-0.5 text-xs text-blue-700">
            You can now register integrations and they&apos;ll be stored
            securely (Fernet-encrypted). Provider-specific OAuth flows,
            webhook endpoints and field mapping will light up in the next
            phases.
          </p>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-20">
          <Plug className="h-10 w-10 text-gray-200" />
          <p className="mt-3 text-sm font-medium text-gray-400">
            No providers match your filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProviders.map((meta) => {
            const integration = byProvider.get(meta.code)
            return (
              <ProviderCard
                key={meta.code}
                meta={meta}
                integration={integration}
                onConnect={() => handleConnect(meta)}
                onManage={() => integration && setManageTarget(integration)}
                onTest={
                  integration
                    ? () => handleTest(integration, meta)
                    : undefined
                }
                testing={testingId === integration?.id}
              />
            )
          })}
        </div>
      )}

      {/* Manage modal (Phase 1 stub — just shows status + disconnect) */}
      {manageTarget && (
        <ManageIntegrationModal
          integration={manageTarget}
          onClose={() => setManageTarget(null)}
          onDisconnect={() => handleDisconnect(manageTarget)}
          disconnecting={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatPill({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'green' | 'red'
}) {
  const tones: Record<'green' | 'red', string> = {
    green: 'border-green-200 bg-green-50 text-green-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  }
  const Icon = tone === 'green' ? CheckCircle2 : AlertCircle
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
        tones[tone],
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>
        {label}: <span className="font-semibold">{value}</span>
      </span>
    </div>
  )
}

function ManageIntegrationModal({
  integration,
  onClose,
  onDisconnect,
  disconnecting,
}: {
  integration: Integration
  onClose: () => void
  onDisconnect: () => void
  disconnecting: boolean
}) {
  const meta = INTEGRATION_PROVIDERS.find((p) => p.code === integration.provider)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            {meta && (
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  meta.color,
                )}
              >
                <Plug className="h-4 w-4" />
              </div>
            )}
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {integration.display_name}
              </h2>
              <p className="text-xs text-gray-400">
                {meta?.name ?? integration.provider}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          <Field label="Status" value={integration.status} />
          <Field
            label="Credentials"
            value={
              integration.has_credentials
                ? Object.entries(integration.credential_preview ?? {})
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ') || 'Stored'
                : 'Not provided'
            }
          />
          {integration.last_sync_at && (
            <Field
              label="Last sync"
              value={new Date(integration.last_sync_at).toLocaleString()}
            />
          )}
          {integration.last_error && (
            <Field label="Last error" value={integration.last_error} error />
          )}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            Provider-specific configuration (OAuth, webhook URLs, field
            mapping, templates) will be available in the next phase.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          {confirmDisconnect ? (
            <>
              <span className="text-xs text-gray-500">Remove integration?</span>
              <button
                type="button"
                onClick={onDisconnect}
                disabled={disconnecting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {disconnecting && <Loader2 className="h-3 w-3 animate-spin" />}
                Yes, disconnect
              </button>
              <button
                type="button"
                onClick={() => setConfirmDisconnect(false)}
                className="rounded-lg px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setConfirmDisconnect(true)}
                className="rounded-lg bg-red-50 px-4 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  error,
}: {
  label: string
  value: string
  error?: boolean
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 break-words text-sm',
          error ? 'text-red-600' : 'text-gray-900',
        )}
      >
        {value}
      </p>
    </div>
  )
}
