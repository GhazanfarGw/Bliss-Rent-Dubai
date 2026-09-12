import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAdminAuth } from '@/features/admin/AdminAuthContext'
import { Spinner } from '@/features/shared/StateMessage'

/**
 * Second gate, nested inside AdminRoute, for the few screens restricted to
 * `super_admin` (currently just the Audit Log — see
 * supabase/migrations/20260831000000_staff_role_restrictions.sql for the
 * matching database-level restriction). A staff account that navigates
 * here directly by URL is bounced to the dashboard rather than seeing a
 * blank/error page — AdminRoute has already confirmed there's a real admin
 * session by the time this runs, so `loading` here only covers the brief
 * moment before adminProfile is populated.
 */
export function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { loading, adminProfile } = useAdminAuth()

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (adminProfile?.role !== 'super_admin') {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}
