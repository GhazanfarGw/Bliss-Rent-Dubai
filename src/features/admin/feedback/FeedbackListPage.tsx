import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'
import { fetchSiteFeedback, type FeedbackSummary } from '@/features/admin/feedback/adminFeedbackApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; summary: FeedbackSummary }

/**
 * Read-only view of what visitors submit through the site-wide Feedback
 * widget (src/features/shared/FeedbackWidget.tsx) — every public page's
 * sticky star-rating + message tab. Submissions are anonymous by design
 * (no customer/booking link), so unlike ComplaintsListPage there is no
 * status workflow or reply action here — just the raw record.
 */
export function FeedbackListPage() {
  const { t } = useTranslation()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchSiteFeedback()
      .then((summary) => {
        if (!cancelled) setState({ status: 'loaded', summary })
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
      <AdminPageHeader title={t('admin.nav.feedback')} description={t('admin.feedback.subtitle')} />

      {state.status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
        </div>
      )}

      {state.status === 'error' && <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />}

      {state.status === 'loaded' && state.summary.count === 0 && (
        <StateMessage title={t('admin.feedback.emptyTitle')} body={t('admin.feedback.emptyBody')} />
      )}

      {state.status === 'loaded' && state.summary.count > 0 && (
        <>
          <div className="mb-6 flex flex-wrap gap-4">
            <div className="rounded-xl border border-brand-navy/10 bg-white p-4">
              <p className="text-xs font-medium text-text-muted">{t('admin.feedback.stats.total')}</p>
              <p className="mt-1 text-2xl font-bold text-brand-navy">{state.summary.count}</p>
            </div>
            <div className="rounded-xl border border-brand-navy/10 bg-white p-4">
              <p className="text-xs font-medium text-text-muted">{t('admin.feedback.stats.average')}</p>
              <p className="mt-1 flex items-center gap-1.5 text-2xl font-bold text-brand-navy">
                {state.summary.averageRating?.toFixed(1)}
                <Star className="h-5 w-5 fill-brand-champagne text-brand-champagne" aria-hidden="true" />
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-brand-navy/10 bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-brand-navy/10 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3 text-start">{t('admin.feedback.columns.rating')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.feedback.columns.message')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.feedback.columns.page')}</th>
                  <th className="px-4 py-3 text-start">{t('admin.feedback.columns.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-navy/5">
                {state.summary.feedback.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-lavender/20">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-0.5" aria-label={t('admin.feedback.ratingValue', { count: row.rating })}>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <Star
                            key={value}
                            className={'h-4 w-4 ' + (value <= row.rating ? 'fill-brand-champagne text-brand-champagne' : 'text-border')}
                            aria-hidden="true"
                          />
                        ))}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-text-muted">{row.message ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.page_path ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{new Date(row.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
