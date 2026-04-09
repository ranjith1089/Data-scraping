import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Edit3,
  Loader2,
  Pause,
  Play,
  Users,
  Megaphone,
  Target,
  Plug,
  Activity,
  XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useAdminTenant,
  useAdminTenantStats,
  useSuspendTenant,
  useReactivateTenant,
  useCancelTenant,
} from '@/hooks/useAdminTenants'
import { useAuthStore } from '@/store/authStore'
import TenantStatusPill from '@/components/admin/TenantStatusPill'
import TenantFormDialog from '@/components/admin/TenantFormDialog'
import SuspendConfirmDialog, {
  type ConfirmAction,
} from '@/components/admin/SuspendConfirmDialog'

/**
 * Detail view for a single tenant — stats cards, metadata, and the
 * suspend / reactivate / cancel action buttons. The current user can
 * never act on their own tenant: those buttons are disabled client-side
 * and rejected server-side.
 */
export default function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)

  const { data: tenant, isLoading } = useAdminTenant(id)
  const { data: stats } = useAdminTenantStats(id)

  const suspendMutation = useSuspendTenant()
  const reactivateMutation = useReactivateTenant()
  const cancelMutation = useCancelTenant()

  const [editOpen, setEditOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<ConfirmAction | null>(
    null,
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10 text-sm text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading tenant...
      </div>
    )
  }
  if (!tenant) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Tenant not found.
      </div>
    )
  }

  const isSelf = currentUser?.tenant_id === tenant.id
  const mutationLoading =
    suspendMutation.isPending ||
    reactivateMutation.isPending ||
    cancelMutation.isPending

  const runAction = async () => {
    if (!pendingAction || !id) return
    try {
      if (pendingAction === 'suspend') {
        await suspendMutation.mutateAsync(id)
        toast.success('Tenant suspended')
      } else if (pendingAction === 'reactivate') {
        await reactivateMutation.mutateAsync(id)
        toast.success('Tenant reactivated')
      } else if (pendingAction === 'cancel') {
        await cancelMutation.mutateAsync(id)
        toast.success('Tenant cancelled')
      }
      setPendingAction(null)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Action failed'
      toast.error(msg)
      setPendingAction(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/admin/tenants')}
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-3 w-3" /> All tenants
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-gray-900">
                  {tenant.name}
                </h1>
                <TenantStatusPill status={tenant.status} />
              </div>
              <p className="font-mono text-xs text-gray-400">{tenant.slug}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Edit3 className="h-3 w-3" /> Edit
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          icon={Users}
          label="Users"
          value={stats?.user_count ?? tenant.user_count ?? 0}
          sub={
            stats
              ? `${stats.active_user_count} active`
              : undefined
          }
        />
        <StatCard
          icon={Target}
          label="Leads"
          value={stats?.lead_count ?? tenant.lead_count ?? 0}
        />
        <StatCard
          icon={Megaphone}
          label="Campaigns"
          value={stats?.campaign_count ?? 0}
        />
        <StatCard
          icon={Plug}
          label="Integrations"
          value={stats?.integration_count ?? 0}
        />
        <StatCard
          icon={Activity}
          label="Last activity"
          value={
            stats?.last_activity_at
              ? new Date(stats.last_activity_at).toLocaleDateString()
              : '—'
          }
          isText
        />
      </div>

      {/* Metadata */}
      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <MetaField label="Plan" value={tenant.plan} />
        <MetaField label="Status" value={tenant.status} />
        <MetaField
          label="Created"
          value={new Date(tenant.created_at).toLocaleString()}
        />
        <MetaField
          label="Updated"
          value={
            tenant.updated_at
              ? new Date(tenant.updated_at).toLocaleString()
              : '—'
          }
        />
        {tenant.suspended_at && (
          <MetaField
            label="Suspended at"
            value={new Date(tenant.suspended_at).toLocaleString()}
          />
        )}
        {tenant.cancelled_at && (
          <MetaField
            label="Cancelled at"
            value={new Date(tenant.cancelled_at).toLocaleString()}
          />
        )}
      </div>

      {/* Actions */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Lifecycle actions
        </h2>
        {isSelf && (
          <p className="mb-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
            You cannot suspend, cancel, or modify your own tenant.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {tenant.status !== 'suspended' && tenant.status !== 'cancelled' && (
            <button
              type="button"
              disabled={isSelf || mutationLoading}
              onClick={() => setPendingAction('suspend')}
              className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-50"
            >
              <Pause className="h-3 w-3" /> Suspend
            </button>
          )}
          {tenant.status === 'suspended' && (
            <button
              type="button"
              disabled={mutationLoading}
              onClick={() => setPendingAction('reactivate')}
              className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
            >
              <Play className="h-3 w-3" /> Reactivate
            </button>
          )}
          {tenant.status !== 'cancelled' && (
            <button
              type="button"
              disabled={isSelf || mutationLoading}
              onClick={() => setPendingAction('cancel')}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle className="h-3 w-3" /> Cancel tenant
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-400">
        <Link to="/admin/tenants" className="hover:text-gray-600">
          ← Back to all tenants
        </Link>
      </div>

      {/* Dialogs */}
      <TenantFormDialog
        open={editOpen}
        tenant={tenant}
        onClose={() => setEditOpen(false)}
      />
      <SuspendConfirmDialog
        action={pendingAction ?? 'suspend'}
        tenantName={tenant.name}
        open={pendingAction !== null}
        loading={mutationLoading}
        onConfirm={runAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  isText,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  sub?: string
  isText?: boolean
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div
        className={
          isText
            ? 'mt-1 text-sm font-medium text-gray-700'
            : 'mt-1 text-2xl font-semibold text-gray-900'
        }
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
    </div>
  )
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm capitalize text-gray-800">{value}</div>
    </div>
  )
}
