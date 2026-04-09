import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

/**
 * Route guard that only lets platform super-admins through.
 *
 * The backend is the authoritative gate (``require_superuser`` dependency),
 * but bouncing non-superusers client-side avoids the 403 round-trip and
 * keeps the admin routes hidden from the URL bar of plain tenant users.
 */
export default function RequireSuperuser({
  children,
}: {
  children: React.ReactNode
}) {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (!user?.is_superuser) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
