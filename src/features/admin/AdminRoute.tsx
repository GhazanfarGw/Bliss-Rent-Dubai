import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { useAdminAuth } from '@/features/admin/AdminAuthContext'
import { Spinner } from '@/features/shared/StateMessage'

/**
 * Gate for every /admin/* page except the login page itself. Four states:
 *  - still checking the session/profile -> spinner, no flash of content
 *  - no session, or a session with no admin_profiles row -> bounce to login
 *  - a suspended admin_profiles row (is_active = false, see the Staff
 *    Accounts screen) -> bounce to login, which shows a distinct
 *    "suspended" message rather than "not authorized"
 *  - a real, active admin -> render the page
 * This is the ONLY place that decision is made, so no individual admin
 * page has to re-implement it.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { loading, session, adminProfile, suspended } = useAdminAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-lavender/30">
        <Spinner className="h-8 w-8" />
        <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
      </div>
    )
  }

  if (!session || !adminProfile || suspended) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
