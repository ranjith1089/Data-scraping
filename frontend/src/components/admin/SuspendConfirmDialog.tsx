import { AlertTriangle, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ConfirmAction = 'suspend' | 'reactivate' | 'cancel'

interface SuspendConfirmDialogProps {
  action: ConfirmAction
  tenantName: string
  open: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const COPY: Record<
  ConfirmAction,
  { title: string; body: string; cta: string; tone: string }
> = {
  suspend: {
    title: 'Suspend tenant?',
    body:
      'Users in this tenant will be blocked from logging in until you ' +
      'reactivate it. Data is retained.',
    cta: 'Suspend',
    tone: 'bg-orange-600 hover:bg-orange-700',
  },
  reactivate: {
    title: 'Reactivate tenant?',
    body: 'Users will be able to log in again immediately.',
    cta: 'Reactivate',
    tone: 'bg-green-600 hover:bg-green-700',
  },
  cancel: {
    title: 'Cancel tenant?',
    body:
      'Login is blocked permanently. Data is retained but the tenant ' +
      'cannot be reactivated — create a new one if needed. This is a ' +
      'soft delete; no rows are actually removed.',
    cta: 'Cancel tenant',
    tone: 'bg-red-600 hover:bg-red-700',
  },
}

/**
 * Reusable confirm modal for the three lifecycle actions. Shares the
 * same overlay+card pattern as the Integrations hub Manage modal so
 * there's one less component to learn.
 */
export default function SuspendConfirmDialog({
  action,
  tenantName,
  open,
  loading,
  onConfirm,
  onCancel,
}: SuspendConfirmDialogProps) {
  if (!open) return null
  const copy = COPY[action]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {copy.title}
              </h2>
              <p className="text-xs text-gray-400">{tenantName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 text-sm leading-relaxed text-gray-600">
          {copy.body}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50',
              copy.tone,
            )}
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {copy.cta}
          </button>
        </div>
      </div>
    </div>
  )
}
