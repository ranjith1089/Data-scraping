import { useState } from 'react'
import { X, Loader2, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCreateLead } from '@/hooks/useLeads'
import {
  SECTOR_NAMES,
  COMPANY_SIZE_OPTIONS,
  STAGE_LABELS,
} from '@/lib/utils'

/**
 * Minimal create-lead modal backed by POST /api/v1/leads/.
 *
 * Scope is deliberately tight: the two backend-required fields
 * (`company_name`, `sector_code`) plus the handful of fields that
 * actually matter for a first-touch lead row. The full edit surface
 * stays on LeadDrawer — this modal is for the "add lead" button on
 * the list page only.
 */
interface AddLeadModalProps {
  onClose: () => void
  onCreated?: (leadId: string) => void
}

interface FormState {
  company_name: string
  sector_code: string
  contact_name: string
  email: string
  phone: string
  website: string
  city: string
  district: string
  state: string
  company_size: string
  stage: string
}

const EMPTY_FORM: FormState = {
  company_name: '',
  sector_code: '',
  contact_name: '',
  email: '',
  phone: '',
  website: '',
  city: '',
  district: '',
  state: '',
  company_size: '',
  stage: 'new',
}

export default function AddLeadModal({ onClose, onCreated }: AddLeadModalProps) {
  const createLead = useCreateLead()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.company_name.trim()) {
      setError('Company name is required.')
      return
    }
    if (!form.sector_code) {
      setError('Please pick a sector.')
      return
    }

    // Strip empty strings so optional fields don't fail backend regex
    // checks (e.g. email "" would not match its pattern).
    const payload: Record<string, unknown> = {
      company_name: form.company_name.trim(),
      sector_code: form.sector_code,
      stage: form.stage || 'new',
    }
    const optionalKeys: Array<keyof FormState> = [
      'contact_name',
      'email',
      'phone',
      'website',
      'city',
      'district',
      'state',
      'company_size',
    ]
    for (const k of optionalKeys) {
      const v = (form[k] ?? '').trim?.() ?? form[k]
      if (v) payload[k] = v
    }

    try {
      const created = await createLead.mutateAsync(payload)
      toast.success('Lead created')
      onCreated?.(created.id)
      onClose()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })
        .response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (Array.isArray(detail)) {
        setError(
          detail
            .map((d: { loc?: unknown[]; msg?: string }) => {
              const field = Array.isArray(d?.loc) ? d.loc.slice(1).join('.') : ''
              return field ? `${field}: ${d?.msg ?? ''}` : d?.msg ?? ''
            })
            .filter(Boolean)
            .join('; '),
        )
      } else {
        setError('Failed to create lead. Please try again.')
      }
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-2xl rounded-xl bg-white shadow-2xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Add Lead</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto p-6 space-y-4">
            {/* Company name */}
            <Field label="Company Name" required>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => update('company_name', e.target.value)}
                placeholder="Acme Corp"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </Field>

            {/* Sector + Stage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Sector" required>
                <select
                  value={form.sector_code}
                  onChange={(e) => update('sector_code', e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select sector…</option>
                  {Object.entries(SECTOR_NAMES).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Stage">
                <select
                  value={form.stage}
                  onChange={(e) => update('stage', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {Object.entries(STAGE_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Contact Name">
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e) => update('contact_name', e.target.value)}
                  placeholder="Priya Sharma"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="priya@acme.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </Field>
              <Field label="Website">
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => update('website', e.target.value)}
                  placeholder="https://acme.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </Field>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="City">
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  placeholder="Bangalore"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </Field>
              <Field label="District">
                <input
                  type="text"
                  value={form.district}
                  onChange={(e) => update('district', e.target.value)}
                  placeholder="Bangalore Urban"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </Field>
              <Field label="State">
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => update('state', e.target.value)}
                  placeholder="Karnataka"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </Field>
            </div>

            {/* Size */}
            <Field label="Company Size">
              <select
                value={form.company_size}
                onChange={(e) => update('company_size', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Unknown</option>
                {COMPANY_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLead.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createLead.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Lead
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}
