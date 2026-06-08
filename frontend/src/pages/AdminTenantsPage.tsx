import { useState } from 'react'
import { Plus, Search, ShieldCheck } from 'lucide-react'
import TenantsTable from '@/components/admin/TenantsTable'
import TenantFormDialog from '@/components/admin/TenantFormDialog'
import {
  useAdminTenants,
  type TenantStatus,
} from '@/hooks/useAdminTenants'

/**
 * Super-admin-only hub listing every tenant on the platform. Filter bar
 * supports search by name/slug plus status filter; the "+ New Tenant"
 * button opens the create dialog.
 */
export default function AdminTenantsPage() {
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<TenantStatus | ''>('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isLoading } = useAdminTenants({
    q: q || undefined,
    status: statusFilter || undefined,
    limit: 100,
  })

  const tenants = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Tenant management
              </h1>
              <p className="text-xs text-muted-foreground">
                Platform-level controls for every organisation on AveonApex
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> New tenant
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-white p-3 shadow-sm">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or slug..."
            className="w-full rounded-lg border border-border/60 bg-white pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as TenantStatus | '')
          }
          className="rounded-lg border border-border/60 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <div className="text-xs text-muted-foreground/70">
          {total} tenant{total === 1 ? '' : 's'}
        </div>
      </div>

      <TenantsTable tenants={tenants} loading={isLoading} />

      <TenantFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  )
}
