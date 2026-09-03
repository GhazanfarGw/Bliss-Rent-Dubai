import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchPayments } from '@/features/admin/payments/adminPaymentsApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { AdminTabs, type AdminTab } from '@/features/admin/shared/AdminTabs'
import { AdminStatusBadge } from '@/features/admin/shared/AdminStatusBadge'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import type { AdminPaymentWithDetails } from '@/types/domain'
import type { Database } from '@/types/database'

type PaymentStatus = Database['public']['Tables']['payments']['Row']['status']
type TabValue = PaymentStatus | 'all'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; payments: AdminPaymentWithDetails[] }

export function PaymentsListPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabValue>('all')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetchPayments(tab)
      .then((payments) => {
        if (!cancelled) setState({ status: 'loaded', payments })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric') })
      })
    return () => {
      cancelled = true
    }
  }, [tab, t])

  const tabs: AdminTab<TabValue>[] = [
    { value: 'all', label: t('admin.payments.tabs.all') },
    { value: 'pending', label: t('admin.payments.tabs.pending') },
    { value: 'paid', label: t('admin.payments.tabs.paid') },
    { value: 'failed', label: t('admin.payments.tabs.failed') },
    { value: 'refunded', label: t('admin.payments.tabs.refunded') },
  ]

  return (
    <div>
      <AdminPageHeader title={t('admin.nav.payments')} description={t('admin.payments.subtitle')} />

      <AdminTabs tabs={tabs} active={tab} onChange={setTab} />

      {state.status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
        </div>
      )}

      {state.status === 'error' && <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />}

      {state.status === 'loaded' && state.payments.length === 0 && (
        <StateMessage title={t('admin.payments.emptyTitle')} body={t('admin.payments.emptyBody')} />
      )}

      {state.status === 'loaded' && state.payments.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-brand-navy/10 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-brand-navy/10 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 text-start">{t('admin.payments.columns.customer')}</th>
                <th className="px-4 py-3 text-start">{t('admin.payments.columns.booking')}</th>
                <th className="px-4 py-3 text-start">{t('admin.payments.columns.amount')}</th>
                <th className="px-4 py-3 text-start">{t('admin.payments.columns.reference')}</th>
                <th className="px-4 py-3 text-start">{t('admin.payments.columns.date')}</th>
                <th className="px-4 py-3 text-start">{t('admin.bookings.columns.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-navy/5">
              {state.payments.map((p) => (
                <tr key={p.id} className="hover:bg-brand-lavender/20">
                  <td className="px-4 py-3 font-medium text-brand-navy">{p.bookings?.customers?.full_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {p.bookings ? (
                      <Link to={`/admin/bookings/${p.booking_id}`} className="font-mono text-xs text-brand-navy underline">
                        {p.booking_id.slice(0, 8)}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.currency} {p.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.provider_reference ?? t('admin.payments.testProvider')}</td>
                  <td className="px-4 py-3 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={p.status} />
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
