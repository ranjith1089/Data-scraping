import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { SECTOR_NAMES, STAGE_LABELS, COMPANY_SIZE_OPTIONS } from '@/lib/utils'

/**
 * Popover filter panel for /leads.
 *
 * All filter state lives in URL search params so deep-links restore the
 * same filtered view and browser back/forward "just works". The panel
 * edits a local draft and only writes to the URL when the user clicks
 * Apply — that way we don't thrash the leads query on every dropdown
 * twitch.
 */
interface LeadFilterPanelProps {
  /** Current active filter values, read from the URL. */
  current: {
    sector_code: string
    stage: string
    company_size: string
    min_score: string
    max_score: string
    city: string
    district: string
  }
  /** Fired with the filtered delta when the user clicks Apply. */
  onApply: (patch: LeadFilterPanelProps['current']) => void
  /** Fired when the user clicks Clear — resets everything to empty. */
  onClear: () => void
  onClose: () => void
  /** Anchor element coordinates so the panel positions next to the button. */
  anchorRef: React.RefObject<HTMLElement>
}

export default function LeadFilterPanel({
  current,
  onApply,
  onClear,
  onClose,
  anchorRef,
}: LeadFilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(current)

  // Re-sync when the URL changes externally (e.g. back button).
  useEffect(() => {
    setDraft(current)
  }, [current])

  // Close on outside click / Escape.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current?.contains(e.target as Node) ||
        anchorRef.current?.contains(e.target as Node)
      ) {
        return
      }
      onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose, anchorRef])

  function update<K extends keyof typeof draft>(
    key: K,
    value: (typeof draft)[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const activeCount = Object.values(current).filter(Boolean).length

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-40 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-900">
          Filters
          {activeCount > 0 && (
            <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
              {activeCount} active
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <Field label="Sector">
          <select
            value={draft.sector_code}
            onChange={(e) => update('sector_code', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All sectors</option>
            {Object.entries(SECTOR_NAMES).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Stage">
          <select
            value={draft.stage}
            onChange={(e) => update('stage', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All stages</option>
            {Object.entries(STAGE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Company Size">
          <select
            value={draft.company_size}
            onChange={(e) => update('company_size', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Any size</option>
            {COMPANY_SIZE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="City">
            <input
              type="text"
              value={draft.city}
              onChange={(e) => update('city', e.target.value)}
              placeholder="Any"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </Field>
          <Field label="District">
            <input
              type="text"
              value={draft.district}
              onChange={(e) => update('district', e.target.value)}
              placeholder="Any"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </Field>
        </div>

        <Field label="AI Score">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={draft.min_score}
              onChange={(e) => update('min_score', e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="number"
              min={0}
              max={100}
              value={draft.max_score}
              onChange={(e) => update('max_score', e.target.value)}
              placeholder="100"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setDraft({
              sector_code: '',
              stage: '',
              company_size: '',
              min_score: '',
              max_score: '',
              city: '',
              district: '',
            })
            onClear()
          }}
          className="text-xs font-medium text-gray-500 hover:text-gray-700"
        >
          Clear all
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft)
              onClose()
            }}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </span>
      {children}
    </label>
  )
}
