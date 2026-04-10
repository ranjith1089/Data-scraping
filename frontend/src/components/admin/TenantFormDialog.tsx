import { useState, useEffect } from 'react'
import { Loader2, X, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useCreateAdminTenant,
  useUpdateAdminTenant,
  type AdminTenant,
  type PlanType,
} from '@/hooks/useAdminTenants'

interface TenantFormDialogProps {
  open: boolean
  tenant?: AdminTenant | null
  onClose: () => void
  onSaved?: (t: AdminTenant) => void
}

const PLAN_OPTIONS: PlanType[] = ['free', 'starter', 'professional', 'enterprise']

interface FormState {
  name: string
  slug: string
  plan: PlanType
  includeOwner: boolean
  ownerEmail: string
  ownerFullName: string
  ownerPassword: string
}

const EMPTY: FormState = {
  name: '',
  slug: '',
  plan: 'starter',
  includeOwner: true,
  ownerEmail: '',
  ownerFullName: '',
  ownerPassword: '',
}

/**
 * Create or edit a tenant. Create mode optionally creates the initial
 * owner user in the same request. Edit mode hides the owner section.
 */
export default function TenantFormDialog({
  open,
  tenant,
  onClose,
  onSaved,
}: TenantFormDialogProps) {
  const isEdit = !!tenant
  const [form, setForm] = useState<FormState>(EMPTY)

  const createMutation = useCreateAdminTenant()
  const updateMutation = useUpdateAdminTenant()
  const loading = createMutation.isPending || updateMutation.isPending

  useEffect(() => {
    if (!open) return
    if (tenant) {
      setForm({
        name: tenant.name,
        slug: tenant.slug,
        plan: (tenant.plan as PlanType) ?? 'starter',
        includeOwner: false,
        ownerEmail: '',
        ownerFullName: '',
        ownerPassword: '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, tenant])

  if (!open) return null

  const autoSlug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 50)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (isEdit && tenant) {
        const updated = await updateMutation.mutateAsync({
          id: tenant.id,
          name: form.name,
          plan: form.plan,
        })
        toast.success('Tenant updated')
        onSaved?.(updated)
        onClose()
      } else {
        const created = await createMutation.mutateAsync({
          name: form.name,
          slug: form.slug,
          plan: form.plan,
          owner: form.includeOwner
            ? {
                email: form.ownerEmail,
                full_name: form.ownerFullName,
                password: form.ownerPassword,
              }
            : null,
        })
        toast.success('Tenant created')
        onSaved?.(created)
        onClose()
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Something went wrong'
      toast.error(msg)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {isEdit ? 'Edit tenant' : 'New tenant'}
              </h2>
              <p className="text-xs text-gray-400">
                {isEdit ? tenant?.slug : 'Create an organisation'}
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

        <div className="space-y-4 px-5 py-5">
          <Labelled label="Organisation name" required>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  // Only auto-derive slug on create, never on edit
                  slug: isEdit ? f.slug : autoSlug(e.target.value),
                }))
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Acme Corp"
            />
          </Labelled>

          <Labelled label="Slug" required>
            <input
              type="text"
              required
              disabled={isEdit}
              value={form.slug}
              onChange={(e) =>
                setForm((f) => ({ ...f, slug: autoSlug(e.target.value) }))
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="acme-corp"
              pattern="[a-z0-9-]+"
            />
          </Labelled>

          <Labelled label="Plan">
            <select
              value={form.plan}
              onChange={(e) =>
                setForm((f) => ({ ...f, plan: e.target.value as PlanType }))
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {PLAN_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </Labelled>

          {!isEdit && (
            <>
              <div className="flex items-center gap-2 border-t border-gray-100 pt-4">
                <input
                  id="include-owner"
                  type="checkbox"
                  checked={form.includeOwner}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, includeOwner: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="include-owner"
                  className="text-sm font-medium text-gray-700"
                >
                  Also create the owner user
                </label>
              </div>

              {form.includeOwner && (
                <div className="space-y-3">
                  <Labelled label="Owner full name" required>
                    <input
                      type="text"
                      required={form.includeOwner}
                      value={form.ownerFullName}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          ownerFullName: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Jane Doe"
                    />
                  </Labelled>
                  <Labelled label="Owner email" required>
                    <input
                      type="email"
                      required={form.includeOwner}
                      value={form.ownerEmail}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          ownerEmail: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="jane@acme.com"
                    />
                  </Labelled>
                  <Labelled label="Owner password" required>
                    <input
                      type="password"
                      required={form.includeOwner}
                      minLength={8}
                      value={form.ownerPassword}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          ownerPassword: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Minimum 8 characters"
                    />
                  </Labelled>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create tenant'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Labelled({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
