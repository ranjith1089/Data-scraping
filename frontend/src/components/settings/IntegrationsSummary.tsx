import { Link } from 'react-router-dom'
import {
  Plug,
  Loader2,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Inbox,
} from 'lucide-react'
import {
  cn,
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATUS_COLOR,
  INTEGRATION_STATUS_LABEL,
  timeAgo,
} from '@/lib/utils'
import { useIntegrations } from '@/hooks/useIntegrations'

/**
 * Compact summary of every configured integration — rendered as the
 * "Integrations" tab inside Settings. The primary UI lives at /integrations;
 * this tab is intentionally lightweight so the user can glance at the state
 * without leaving Settings.
 */
export default function IntegrationsSummary() {
  const { data: integrations = [], isLoading } = useIntegrations()

  const connected = integrations.filter((i) => i.status === 'connected').length
  const errored = integrations.filter((i) => i.status === 'error').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Plug className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
        </div>
        <Link
          to="/integrations"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Manage Integrations
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Available providers"
          value={String(INTEGRATION_PROVIDERS.length)}
          tone="neutral"
        />
        <StatCard
          label="Connected"
          value={String(connected)}
          tone="green"
          icon={CheckCircle2}
        />
        <StatCard
          label="Needs attention"
          value={String(errored)}
          tone={errored > 0 ? 'red' : 'neutral'}
          icon={AlertCircle}
        />
      </div>

      {/* Configured list */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Configured integrations
          </h3>
          <span className="text-xs text-gray-400">
            {integrations.length} total
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : integrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Inbox className="h-9 w-9 text-gray-200" />
            <p className="mt-3 text-sm font-medium text-gray-400">
              No integrations yet
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Head to the Integrations page to connect your first provider.
            </p>
            <Link
              to="/integrations"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Browse providers
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {integrations.map((integration) => {
              const meta = INTEGRATION_PROVIDERS.find(
                (p) => p.code === integration.provider,
              )
              const statusColor =
                INTEGRATION_STATUS_COLOR[integration.status] ??
                INTEGRATION_STATUS_COLOR.disconnected
              return (
                <li
                  key={integration.id}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-gray-50"
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      meta?.color ?? 'bg-gray-100 text-gray-500',
                    )}
                  >
                    <Plug className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {integration.display_name}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {meta?.name ?? integration.provider}
                      {integration.last_sync_at && (
                        <> · Synced {timeAgo(integration.last_sync_at)}</>
                      )}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                      statusColor,
                    )}
                  >
                    {INTEGRATION_STATUS_LABEL[integration.status] ??
                      'Unknown'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string
  value: string
  tone: 'neutral' | 'green' | 'red'
  icon?: React.ComponentType<{ className?: string }>
}) {
  const tones: Record<'neutral' | 'green' | 'red', string> = {
    neutral: 'border-gray-200 bg-white text-gray-900',
    green: 'border-green-200 bg-green-50 text-green-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  }
  return (
    <div className={cn('rounded-xl border p-4', tones[tone])}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider opacity-80">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}
