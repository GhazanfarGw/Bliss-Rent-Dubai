import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchAllExtensions } from '@/features/admin/extensions/adminExtensionsApi'
import { CurrentRentedCarsSection } from '@/features/admin/extensions/CurrentRentedCarsSection'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { AdminTabs, type AdminTab } from '@/features/admin/shared/AdminTabs'
import { AdminStatusBadge } from '@/features/admin/shared/AdminStatusBadge'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import { formatBookingReference } from '@/lib/bookingReference'
import type { AdminExtensionWithDetails } from '@/types/domain'
import type { ExtensionStatus } from '@/types/database'

type TabValue = ExtensionStatus | 'all'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; extensions: AdminExtensionWithDetails[] }

/**
 * Phase 7 — the global "view extension history" screen the spec asks for:
 * every rental extension request across every booking, regardless of
 * which booking page it was recorded from. The actual record/process
 * workflow lives on BookingDetailPage (per-booking, in context) — this
 * page is read-only. fetchAllExtensions has no server-side status filter
 * (this table only ever gets one row per confirmed support request, so
 * it stays small), so the tabs filter the already-loaded list
 * client-side rather than re-querying — see adminExtensionsApi.ts.
 */
export function ExtensionsListPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabValue>('all')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  async function loadExtensions() {
    try {
      const extensions = await fetchAllExtensions()
      setState({ status: 'loaded', extensions })
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'),
      })
    }
  }

  useEffect(() => {
    void loadExtensions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tabs: AdminTab<TabValue>[] = [
    { value: 'all', label: t('admin.extensions.tabs.all') },
    { value: 'requested', label: t('admin.extensions.tabs.requested') },
    { value: 'conflict_unresolved', label: t('admin.extensions.tabs.conflict_unresolved') },
    { value: 'pending', label: t('admin.extensions.tabs.pending') },
    { value: 'approved', label: t('admin.extensions.tabs.approved') },
    { value: 'rejected', label: t('admin.extensions.tabs.rejected') },
  ]

  const visible = state.status === 'loaded' ? state.extensions.filter((e) => tab === 'all' || e.status === tab) : []

  return (
    <div>
      <AdminPageHeader title={t('admin.nav.extensions')} description={t('admin.extensions.subtitle')} />

      <div className="mb-5">
        <CurrentRentedCarsSection onExtended={() => void loadExtensions()} />
      </div>

      <AdminTabs tabs={tabs} active={tab} onChange={setTab} />

      {state.status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
        </div>
      )}

      {state.status === 'error' && <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />}

      {state.status === 'loaded' && visible.length === 0 && (
        <StateMessage title={t('admin.extensions.emptyTitle')} body={t('admin.extensions.emptyBody')} />
      )}

      {state.status === 'loaded' && visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-brand-navy/10 bg-white">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-brand-navy/10 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 text-start">{t('admin.extensions.columns.customer')}</th>
                <th className="px-4 py-3 text-start">{t('admin.extensions.columns.booking')}</th>
                <th className="px-4 py-3 text-start">{t('admin.extensions.columns.vehicle')}</th>
                <th className="px-4 py-3 text-start">{t('admin.extensions.columns.source')}</th>
                <th className="px-4 py-3 text-start">{t('admin.extensions.columns.dates')}</th>
                <th className="px-4 py-3 text-start">{t('admin.extensions.columns.days')}</th>
                <th className="px-4 py-3 text-start">{t('admin.extensions.columns.amount')}</th>
                <th className="px-4 py-3 text-start">{t('admin.extensions.columns.payment')}</th>
                <th className="px-4 py-3 text-start">{t('admin.bookings.columns.status')}</th>
                <th className="px-4 py-3 text-start">{t('admin.extensions.columns.date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-navy/5">
              {visible.map((ext) => {
                const booking = ext.bookings
                const vehicle = booking?.vehicles ?? null
                return (
                  <tr key={ext.id} className="hover:bg-brand-lavender/20">
                    <td className="px-4 py-3 font-medium text-brand-navy">{booking?.customers?.full_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {booking ? (
                        <Link to={`/admin/bookings/${ext.booking_id}`} className="font-mono text-xs text-brand-navy underline">
                          {formatBookingReference(booking.id)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.plate_number}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">{t(`admin.extensions.source.${ext.source}`)}</td>
                    <td className="px-4 py-3 text-xs">
                      {ext.previous_return_date} → {ext.requested_return_date}
                      {ext.is_late && (
                        <span className="ms-1.5 inline-flex items-center rounded-full bg-warning-bg px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                          {t('admin.extensions.table.late')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{ext.extension_days}</td>
                    <td className="px-4 py-3">{ext.amount != null ? `${ext.currency} ${ext.amount.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3">
                      {ext.payment_method ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs capitalize text-text-muted">
                            {t(`admin.extensions.form.paymentMethod${ext.payment_method === 'cash' ? 'Cash' : 'Online'}`)}
                          </span>
                          {ext.payment_status && <AdminStatusBadge status={ext.payment_status} />}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge status={ext.status} />
                    </td>
                    <td className="px-4 py-3 text-xs">{new Date(ext.created_at).toLocaleDateString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
