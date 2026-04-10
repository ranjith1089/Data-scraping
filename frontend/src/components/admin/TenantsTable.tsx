import { Link } from 'react-router-dom'
import { ChevronRight, Loader2 } from 'lucide-react'
import TenantStatusPill from './TenantStatusPill'
import type { AdminTenant } from '@/hooks/useAdminTenants'

interface TenantsTableProps {
  tenants: AdminTenant[]
  loading?: boolean
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Dense list of tenants for the super-admin hub. Rows link into the
 * detail page; row actions (suspend/reactivate/cancel) live on that
 * detail page, not in-row, so this component stays presentational.
 */
export default function TenantsTable({ tenants, loading }: TenantsTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-10 text-sm text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading tenants...
      </div>
    )
  }

  if (tenants.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        No tenants match your filters.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-100 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Plan</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Users</th>
            <th className="px-4 py-3 font-medium">Leads</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tenants.map((t) => (
            <tr
              key={t.id}
              className="transition-colors hover:bg-gray-50"
            >
              <td className="px-4 py-3">
                <Link
                  to={`/admin/tenants/${t.id}`}
                  className="block"
                >
                  <div className="font-medium text-gray-900">{t.name}</div>
                  <div className="font-mono text-[11px] text-gray-400">
                    {t.slug}
                  </div>
                </Link>
              </td>
              <td className="px-4 py-3 capitalize text-gray-600">{t.plan}</td>
              <td className="px-4 py-3">
                <TenantStatusPill status={t.status} />
              </td>
              <td className="px-4 py-3 text-gray-600">
                {t.user_count ?? 0}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {t.lead_count ?? 0}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {formatDate(t.created_at)}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  to={`/admin/tenants/${t.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  View
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
