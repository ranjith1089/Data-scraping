import { CheckCircle2, AlertCircle, Plug, Loader2, Zap } from 'lucide-react'
import {
  cn,
  INTEGRATION_STATUS_COLOR,
  INTEGRATION_STATUS_LABEL,
  timeAgo,
  type IntegrationProviderMeta,
} from '@/lib/utils'
import type { Integration } from '@/hooks/useIntegrations'

interface ProviderCardProps {
  meta: IntegrationProviderMeta
  integration?: Integration
  onConnect: () => void
  onManage: () => void
  onTest?: () => void
  testing?: boolean
}

/**
 * Provider card shown on the Integrations hub.
 *
 * Two states:
 *   1. Not connected — shows description + "Connect" CTA
 *   2. Connected/error/expired — shows status pill, last sync, Manage + Test buttons
 */
export default function ProviderCard({
  meta,
  integration,
  onConnect,
  onManage,
  onTest,
  testing,
}: ProviderCardProps) {
  const isConnected = !!integration
  const status = integration?.status ?? 'disconnected'
  const statusLabel = INTEGRATION_STATUS_LABEL[status] ?? 'Unknown'
  const statusColor =
    INTEGRATION_STATUS_COLOR[status] ?? INTEGRATION_STATUS_COLOR.disconnected

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border bg-white p-5 shadow-sm transition-all hover:shadow-md',
        isConnected ? meta.accent : 'border-gray-200',
      )}
    >
      {/* Header: icon + name */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              meta.color,
            )}
          >
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {meta.name}
            </h3>
            <p className="text-xs text-gray-400 capitalize">{meta.category}</p>
          </div>
        </div>

        {/* Status pill (only when connected) */}
        {isConnected && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
              statusColor,
            )}
          >
            {status === 'connected' && <CheckCircle2 className="h-3 w-3" />}
            {(status === 'error' || status === 'expired') && (
              <AlertCircle className="h-3 w-3" />
            )}
            {statusLabel}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mt-3 flex-1 text-xs leading-relaxed text-gray-500">
        {meta.description}
      </p>

      {/* Metadata footer (connected only) */}
      {isConnected && (
        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-[11px] text-gray-400">
          {integration.last_sync_at ? (
            <p>
              Last sync{' '}
              <span className="font-medium text-gray-600">
                {timeAgo(integration.last_sync_at)}
              </span>
            </p>
          ) : (
            <p>Not tested yet</p>
          )}
          {integration.last_error && (
            <p className="truncate text-red-500" title={integration.last_error}>
              {integration.last_error}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {isConnected ? (
          <>
            <button
              type="button"
              onClick={onManage}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Manage
            </button>
            {onTest && (
              <button
                type="button"
                onClick={onTest}
                disabled={testing}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                title="Test connection"
              >
                {testing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                Test
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  )
}
