import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Calendar, Eye } from 'lucide-react'
import { fetchBookings } from '@/features/admin/bookings/adminBookingsApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { AdminTabs, type AdminTab } from '@/features/admin/shared/AdminTabs'
import { AdminStatusBadge } from '@/features/admin/shared/AdminStatusBadge'
import { SearchField } from '@/features/shared/ui'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import type { AdminBookingWithDetails } from '@/types/domain'
import type { Database } from '@/types/database'

type BookingStatus = Database['public']['Tables']['bookings']['Row']['status']
type TabValue = BookingStatus | 'all'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; bookings: AdminBookingWithDetails[] }

export function BookingsListPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabValue>('all')
  const [search, setSearch] = useState('')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    // Fetch every booking once (not per-tab) so tab counts can be computed
    // across the whole set client-side — same pattern as FleetListPage.
    fetchBookings('all')
      .then((bookings) => {
        if (!cancelled) setState({ status: 'loaded', bookings })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric') })
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const counts = useMemo(() => {
    if (state.status !== 'loaded') return {}
    const c: Record<string, number> = {}
    for (const b of state.bookings) c[b.status] = (c[b.status] ?? 0) + 1
    return c
  }, [state])

  const filtered = useMemo(() => {
    if (state.status !== 'loaded') return []
    const byTab = tab === 'all' ? state.bookings : state.bookings.filter((b) => b.status === tab)
    const q = search.trim().toLowerCase()
    if (!q) return byTab
    return byTab.filter((b) => {
      const haystack = [
        b.customers?.full_name,
        b.customers?.email,
        b.vehicles?.make,
        b.vehicles?.model,
        b.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [state, tab, search])

  const tabs: AdminTab<TabValue>[] = [
    { value: 'all', label: t('admin.bookings.tabs.all'), count: state.status === 'loaded' ? state.bookings.length : undefined },
    { value: 'pending_payment', label: t('admin.bookings.tabs.pending'), count: counts.pending_payment },
    { value: 'confirmed', label: t('admin.bookings.tabs.confirmed'), count: counts.confirmed },
    { value: 'active', label: t('admin.bookings.tabs.active'), count: counts.active },
    { value: 'completed', label: t('admin.bookings.tabs.completed'), count: counts.completed },
    { value: 'cancelled', label: t('admin.bookings.tabs.cancelled'), count: counts.cancelled },
  ]

  return (
    <div>
      <AdminPageHeader title={t('admin.nav.bookings')} description={t('admin.bookings.subtitle')} />

      <AdminTabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="mb-4 max-w-sm">
        <SearchField
          label={t('admin.bookings.searchPlaceholder')}
          hideLabel
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.bookings.searchPlaceholder')}
        />
      </div>

      {state.status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
        </div>
      )}

      {state.status === 'error' && <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />}

      {state.status === 'loaded' && filtered.length === 0 && (
        <StateMessage title={t('admin.bookings.emptyTitle')} body={t('admin.bookings.emptyBody')} />
      )}

      {state.status === 'loaded' && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-brand-navy/10 bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-brand-navy/10 text-start text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 text-start">{t('admin.bookings.columns.customer')}</th>
                <th className="px-4 py-3 text-start">{t('admin.bookings.columns.vehicle')}</th>
                <th className="px-4 py-3 text-start">{t('admin.bookings.columns.dates')}</th>
                <th className="px-4 py-3 text-start">{t('admin.bookings.columns.amount')}</th>
                <th className="px-4 py-3 text-start">{t('admin.bookings.columns.payment')}</th>
                <th className="px-4 py-3 text-start">{t('admin.bookings.columns.status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-navy/5">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-brand-lavender/20">
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-navy">{b.customers?.full_name ?? '—'}</p>
                    <p className="text-xs text-text-muted">{b.customers?.email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    {b.vehicles ? `${b.vehicles.make} ${b.vehicles.model}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 shrink-0 text-brand-gold" aria-hidden="true" />
                      {b.start_date} → {b.end_date}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {b.currency} {b.total_price.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={b.payments[0]?.status ?? 'pending'} />
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Link
                      to={`/admin/bookings/${b.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-navy underline"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('admin.bookings.view')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
