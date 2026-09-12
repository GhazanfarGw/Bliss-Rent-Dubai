import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchDashboardKpis, fetchRecentActivity, AdminApiError, type DashboardKpis, type RecentActivity } from '@/features/admin/adminApi'
import { useAdminAuth } from '@/features/admin/AdminAuthContext'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { AdminStatusBadge } from '@/features/admin/shared/AdminStatusBadge'
import { RevenueSection } from '@/features/admin/dashboard/RevenueSection'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; kpis: DashboardKpis; activity: RecentActivity }

export function DashboardPage() {
  const { t } = useTranslation()
  const { adminProfile } = useAdminAuth()
  const isSuperAdmin = adminProfile?.role === 'super_admin'
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    Promise.all([fetchDashboardKpis(), fetchRecentActivity()])
      .then(([kpis, activity]) => {
        if (!cancelled) setState({ status: 'loaded', kpis, activity })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric') })
      })
    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <div>
      <AdminPageHeader title={t('admin.nav.dashboard')} description={t('admin.dashboard.subtitle')} />

      <p className="-mt-4 mb-6 text-sm text-brand-navy/70">
        {isSuperAdmin
          ? t('admin.dashboard.greeting.super_admin', { name: adminProfile?.full_name })
          : t('admin.dashboard.greeting.staff', { name: adminProfile?.full_name })}
      </p>

      {isSuperAdmin && (
        <div className="mb-8">
          <RevenueSection />
        </div>
      )}

      {state.status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
        </div>
      )}

      {state.status === 'error' && <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />}

      {state.status === 'loaded' && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-brand-navy">{t('admin.dashboard.bookingsSection')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <KpiTile label={t('admin.dashboard.newBookings')} value={state.kpis.newBookings} />
              <KpiTile label={t('admin.dashboard.confirmedBookings')} value={state.kpis.confirmedBookings} />
              <KpiTile label={t('admin.dashboard.activeRentals')} value={state.kpis.activeRentals} />
              <KpiTile label={t('admin.dashboard.returnsDue')} value={state.kpis.returnsDue} warn={state.kpis.returnsDue > 0} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-brand-navy">{t('admin.dashboard.fleetSection')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile label={t('admin.status.available')} value={state.kpis.vehiclesAvailable} />
              <KpiTile label={t('admin.status.reserved')} value={state.kpis.vehiclesReserved} />
              <KpiTile label={t('admin.status.rented')} value={state.kpis.vehiclesRented} />
              <KpiTile label={t('admin.status.maintenance')} value={state.kpis.vehiclesMaintenance} warn={state.kpis.vehiclesMaintenance > 0} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-brand-navy">{t('admin.dashboard.opsSection')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <KpiTile label={t('admin.dashboard.pendingPayments')} value={state.kpis.pendingPayments} warn={state.kpis.pendingPayments > 0} />
              <KpiTile label={t('admin.dashboard.openComplaints')} value={state.kpis.openComplaints} warn={state.kpis.openComplaints > 0} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <ActivityCard title={t('admin.dashboard.recentBookings')} emptyLabel={t('admin.dashboard.noRecentBookings')}>
              {state.activity.recentBookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link to={`/admin/bookings/${b.id}`} className="block truncate font-medium text-brand-navy hover:underline">
                      {b.customer_name}
                    </Link>
                    <p className="text-xs text-text-muted">
                      {b.currency} {b.total_price.toLocaleString()}
                    </p>
                  </div>
                  <AdminStatusBadge status={b.status} />
                </li>
              ))}
            </ActivityCard>

            <ActivityCard title={t('admin.dashboard.recentPayments')} emptyLabel={t('admin.dashboard.noRecentPayments')}>
              {state.activity.recentPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-brand-navy">{p.customer_name}</p>
                    <p className="text-xs text-text-muted">
                      {p.currency} {p.amount.toLocaleString()}
                    </p>
                  </div>
                  <AdminStatusBadge status={p.status} />
                </li>
              ))}
            </ActivityCard>

            <ActivityCard title={t('admin.dashboard.recentComplaints')} emptyLabel={t('admin.dashboard.noRecentComplaints')}>
              {state.activity.recentComplaints.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-brand-navy">{c.subject}</p>
                    <p className="truncate text-xs text-text-muted">{c.customer_name}</p>
                  </div>
                  <AdminStatusBadge status={c.status} />
                </li>
              ))}
            </ActivityCard>
          </section>
        </div>
      )}
    </div>
  )
}

function KpiTile({ label, value, warn, isText }: { label: string; value: number | string; warn?: boolean; isText?: boolean }) {
  return (
    <div className="rounded-xl border border-brand-navy/10 bg-white p-4">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className={'mt-1 font-bold text-brand-navy ' + (isText ? 'text-lg' : 'text-2xl') + (warn ? ' text-warning' : '')}>
        {value}
      </p>
    </div>
  )
}

function ActivityCard({ title, emptyLabel, children }: { title: string; emptyLabel: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <div className="rounded-xl border border-brand-navy/10 bg-white p-4">
      <h3 className="text-sm font-semibold text-brand-navy">{title}</h3>
      {hasChildren ? (
        <ul className="mt-2 divide-y divide-brand-navy/5">{children}</ul>
      ) : (
        <p className="mt-3 text-sm text-text-muted">{emptyLabel}</p>
      )}
    </div>
  )
}
