import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchComplaints } from '@/features/admin/complaints/adminComplaintsApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { AdminTabs, type AdminTab } from '@/features/admin/shared/AdminTabs'
import { AdminStatusBadge } from '@/features/admin/shared/AdminStatusBadge'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import type { AdminComplaintWithDetails } from '@/types/domain'
import type { Database } from '@/types/database'

type ComplaintStatus = Database['public']['Tables']['complaints']['Row']['status']
type TabValue = ComplaintStatus | 'all'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; complaints: AdminComplaintWithDetails[] }

export function ComplaintsListPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabValue>('open')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetchComplaints(tab)
      .then((complaints) => {
        if (!cancelled) setState({ status: 'loaded', complaints })
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
    { value: 'open', label: t('admin.complaints.tabs.open') },
    { value: 'in_progress', label: t('admin.complaints.tabs.inProgress') },
    { value: 'resolved', label: t('admin.complaints.tabs.resolved') },
    { value: 'closed', label: t('admin.complaints.tabs.closed') },
    { value: 'all', label: t('admin.complaints.tabs.all') },
  ]

  return (
    <div>
      <AdminPageHeader title={t('admin.nav.complaints')} description={t('admin.complaints.subtitle')} />

      <AdminTabs tabs={tabs} active={tab} onChange={setTab} />

      {state.status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
        </div>
      )}

      {state.status === 'error' && <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />}

      {state.status === 'loaded' && state.complaints.length === 0 && (
        <StateMessage title={t('admin.complaints.emptyTitle')} body={t('admin.complaints.emptyBody')} />
      )}

      {state.status === 'loaded' && state.complaints.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-brand-navy/10 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-brand-navy/10 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 text-start">{t('admin.complaints.columns.subject')}</th>
                <th className="px-4 py-3 text-start">{t('admin.complaints.columns.customer')}</th>
                <th className="px-4 py-3 text-start">{t('admin.complaints.columns.booking')}</th>
                <th className="px-4 py-3 text-start">{t('admin.complaints.columns.date')}</th>
                <th className="px-4 py-3 text-start">{t('admin.bookings.columns.status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-navy/5">
              {state.complaints.map((c) => (
                <tr key={c.id} className="hover:bg-brand-lavender/20">
                  <td className="max-w-[220px] truncate px-4 py-3 font-medium text-brand-navy">{c.subject}</td>
                  <td className="px-4 py-3">{c.customers?.full_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.bookings ? (
                      <Link to={`/admin/bookings/${c.bookings.id}`} className="font-mono text-xs text-brand-navy underline">
                        {c.bookings.id.slice(0, 8)}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Link to={`/admin/complaints/${c.id}`} className="text-xs font-semibold text-brand-navy underline">
                      {t('admin.complaints.view')}
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
