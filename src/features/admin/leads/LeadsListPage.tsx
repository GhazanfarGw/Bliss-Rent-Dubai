import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircle, Trash2 } from 'lucide-react'
import { deleteLead, fetchLeads, updateLeadStatus, LEAD_STATUSES, type AdminLeadRow, type LeadStatus } from '@/features/admin/leads/adminLeadsApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'loaded'; leads: AdminLeadRow[] }

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: 'bg-brand-gold/15 text-brand-gold-dark',
  quoted: 'bg-brand-lavender text-brand-navy',
  booked: 'bg-success-bg text-success',
  lost: 'bg-error-bg text-error',
}

/**
 * Quote requests from the car-page "price on WhatsApp" box (source_code
 * QUOTE) plus any manually logged leads. Each row: one-tap WhatsApp reply
 * and a status the team moves new → quoted → booked / lost.
 */
export function LeadsListPage() {
  const { t } = useTranslation()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [rowError, setRowError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchLeads()
      .then((leads) => !cancelled && setState({ status: 'loaded', leads }))
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric') })
      })
    return () => {
      cancelled = true
    }
  }, [t])

  function patch(fn: (rows: AdminLeadRow[]) => AdminLeadRow[]) {
    setState((s) => (s.status === 'loaded' ? { status: 'loaded', leads: fn(s.leads) } : s))
  }

  async function changeStatus(id: string, status: LeadStatus) {
    setRowError('')
    try {
      await updateLeadStatus(id, status)
      patch((rows) => rows.map((r) => (r.id === id ? { ...r, status } : r)))
    } catch (err) {
      setRowError(err instanceof Error ? err.message : t('admin.errorGeneric'))
    }
  }

  async function remove(id: string) {
    setRowError('')
    try {
      await deleteLead(id)
      patch((rows) => rows.filter((r) => r.id !== id))
    } catch (err) {
      setRowError(err instanceof Error ? err.message : t('admin.errorGeneric'))
    }
  }

  const leads = state.status === 'loaded' ? state.leads : []
  const newCount = leads.filter((l) => l.status === 'new').length

  return (
    <div>
      <AdminPageHeader title={t('admin.nav.leads')} description={t('admin.leads.subtitle')} />

      {state.status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
        </div>
      )}
      {state.status === 'error' && <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />}
      {state.status === 'loaded' && leads.length === 0 && <StateMessage title={t('admin.leads.emptyTitle')} body={t('admin.leads.emptyBody')} />}

      {state.status === 'loaded' && leads.length > 0 && (
        <>
          <div className="mb-6 flex flex-wrap gap-4">
            <div className="rounded-xl border border-brand-navy/10 bg-white p-4">
              <p className="text-xs font-medium text-text-muted">{t('admin.leads.stats.total')}</p>
              <p className="mt-1 text-2xl font-bold text-brand-navy">{leads.length}</p>
            </div>
            <div className="rounded-xl border border-brand-navy/10 bg-white p-4">
              <p className="text-xs font-medium text-text-muted">{t('admin.leads.stats.new')}</p>
              <p className="mt-1 text-2xl font-bold text-brand-gold-dark">{newCount}</p>
            </div>
          </div>
          {rowError && <p role="alert" className="mb-3 text-sm text-error">{rowError}</p>}

          <div className="overflow-x-auto rounded-xl border border-brand-navy/10 bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-brand-navy/10 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3 text-start">{t('admin.leads.columns.date')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.leads.columns.customer')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.leads.columns.car')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.leads.columns.dates')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.leads.columns.source')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.leads.columns.status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-navy/5">
                {leads.map((l) => {
                  const wa = l.phone ? `https://wa.me/${l.phone.replace(/\D/g, '')}?text=${encodeURIComponent(t('admin.leads.waGreeting', { name: l.full_name ?? '', car: l.car_interest ?? t('admin.leads.aCar') }))}` : null
                  return (
                    <tr key={l.id} className="align-top hover:bg-brand-lavender/20">
                      <td className="px-4 py-3 text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-brand-navy">{l.full_name ?? '—'}</p>
                        <p className="font-mono text-xs text-text-muted" dir="ltr">{l.phone ?? '—'}</p>
                        {l.notes && <p className="mt-1 max-w-xs text-xs text-text-muted">{l.notes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {l.car_interest ?? '—'}
                        {l.estimated_value != null && <p className="text-xs text-text-muted">≈ {l.currency} {Number(l.estimated_value).toLocaleString()}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" dir="ltr">{l.start_date || l.end_date ? `${l.start_date ?? '?'} → ${l.end_date ?? '?'}` : '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        {l.source}
                        {l.utm_campaign && <p className="text-text-muted">{l.utm_campaign}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={t('admin.leads.columns.status')}
                          value={l.status}
                          onChange={(e) => changeStatus(l.id, e.target.value as LeadStatus)}
                          className={'rounded-full border-0 px-3 py-1 text-xs font-semibold ' + STATUS_STYLE[l.status]}
                        >
                          {LEAD_STATUSES.map((s) => (
                            <option key={s} value={s}>{t(`admin.leads.status.${s}`)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {wa && (
                            <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              WhatsApp
                            </a>
                          )}
                          <button type="button" onClick={() => remove(l.id)} aria-label={t('admin.leads.delete')} title={t('admin.leads.delete')} className="rounded-full p-1.5 text-text-muted hover:bg-error-bg hover:text-error">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
