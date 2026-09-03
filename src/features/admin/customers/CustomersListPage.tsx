import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchCustomers } from '@/features/admin/customers/adminCustomersApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { AdminTabs, type AdminTab } from '@/features/admin/shared/AdminTabs'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import type { AdminCustomerWithStats } from '@/types/domain'

type TabValue = 'all' | 'active'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; customers: AdminCustomerWithStats[] }

export function CustomersListPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabValue>('all')
  const [search, setSearch] = useState('')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchCustomers()
      .then((customers) => {
        if (!cancelled) setState({ status: 'loaded', customers })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric') })
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const filtered = useMemo(() => {
    if (state.status !== 'loaded') return []
    let list = state.customers
    if (tab === 'active') list = list.filter((c) => c.active_booking_count > 0)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((c) => [c.full_name, c.email, c.phone].filter(Boolean).join(' ').toLowerCase().includes(q))
    }
    return list
  }, [state, tab, search])

  const tabs: AdminTab<TabValue>[] = [
    { value: 'all', label: t('admin.customers.tabs.all'), count: state.status === 'loaded' ? state.customers.length : undefined },
    {
      value: 'active',
      label: t('admin.customers.tabs.active'),
      count: state.status === 'loaded' ? state.customers.filter((c) => c.active_booking_count > 0).length : undefined,
    },
  ]

  return (
    <div>
      <AdminPageHeader title={t('admin.nav.customers')} description={t('admin.customers.subtitle')} />

      <AdminTabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.customers.searchPlaceholder')}
          className="w-full max-w-sm rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
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
        <StateMessage title={t('admin.customers.emptyTitle')} body={t('admin.customers.emptyBody')} />
      )}

      {state.status === 'loaded' && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-brand-navy/10 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-brand-navy/10 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 text-start">{t('admin.customers.columns.name')}</th>
                <th className="px-4 py-3 text-start">{t('admin.customers.columns.email')}</th>
                <th className="px-4 py-3 text-start">{t('admin.customers.columns.phone')}</th>
                <th className="px-4 py-3 text-start">{t('admin.customers.columns.bookings')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-navy/5">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-brand-lavender/20">
                  <td className="px-4 py-3 font-medium text-brand-navy">{c.full_name}</td>
                  <td className="px-4 py-3">{c.email}</td>
                  <td className="px-4 py-3">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3">{c.booking_count}</td>
                  <td className="px-4 py-3 text-end">
                    <Link to={`/admin/customers/${c.id}`} className="text-xs font-semibold text-brand-navy underline">
                      {t('admin.customers.view')}
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
