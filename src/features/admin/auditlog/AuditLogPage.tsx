import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchAuditLog } from '@/features/admin/auditlog/adminAuditApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { AdminTabs, type AdminTab } from '@/features/admin/shared/AdminTabs'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import type { AdminAuditLogEntry } from '@/types/domain'

type TabValue = 'all' | 'vehicles' | 'pricing' | 'bookings' | 'complaints'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; entries: AdminAuditLogEntry[] }

export function AuditLogPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabValue>('all')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetchAuditLog(tab === 'all' ? undefined : tab)
      .then((entries) => {
        if (!cancelled) setState({ status: 'loaded', entries })
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
    { value: 'all', label: t('admin.auditLog.tabs.all') },
    { value: 'vehicles', label: t('admin.nav.fleet') },
    { value: 'pricing', label: t('admin.nav.pricing') },
    { value: 'bookings', label: t('admin.nav.bookings') },
    { value: 'complaints', label: t('admin.nav.complaints') },
  ]

  return (
    <div>
      <AdminPageHeader title={t('admin.nav.auditLog')} description={t('admin.auditLog.subtitle')} />

      <AdminTabs tabs={tabs} active={tab} onChange={setTab} />

      {state.status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
        </div>
      )}

      {state.status === 'error' && <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />}

      {state.status === 'loaded' && state.entries.length === 0 && (
        <StateMessage title={t('admin.auditLog.emptyTitle')} body={t('admin.auditLog.emptyBody')} />
      )}

      {state.status === 'loaded' && state.entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-brand-navy/10 bg-white">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-brand-navy/10 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 text-start">{t('admin.auditLog.columns.action')}</th>
                <th className="px-4 py-3 text-start">{t('admin.auditLog.columns.entity')}</th>
                <th className="px-4 py-3 text-start">{t('admin.auditLog.columns.actor')}</th>
                <th className="px-4 py-3 text-start">{t('admin.auditLog.columns.date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-navy/5">
              {state.entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-brand-lavender/20">
                  <td className="px-4 py-3 font-medium text-brand-navy">{entry.action}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {entry.entity_table}
                    {entry.entity_id ? ` · ${entry.entity_id.slice(0, 8)}` : ''}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.actor_id ? entry.actor_id.slice(0, 8) : t('admin.auditLog.systemActor')}</td>
                  <td className="px-4 py-3 text-xs">{new Date(entry.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
