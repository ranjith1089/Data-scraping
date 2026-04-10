import { CheckCircle2, Pause, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TENANT_STATUS_COLOR,
  TENANT_STATUS_LABEL,
  type TenantStatus,
} from '@/hooks/useAdminTenants'

interface TenantStatusPillProps {
  status: TenantStatus
  className?: string
}

/**
 * Small colored pill for a tenant's lifecycle status. Matches the styling
 * of the provider status pill on the Integrations hub so the admin UI
 * feels consistent with the rest of the app.
 */
export default function TenantStatusPill({
  status,
  className,
}: TenantStatusPillProps) {
  const Icon =
    status === 'active'
      ? CheckCircle2
      : status === 'suspended'
        ? Pause
        : XCircle

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        TENANT_STATUS_COLOR[status],
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {TENANT_STATUS_LABEL[status]}
    </span>
  )
}
