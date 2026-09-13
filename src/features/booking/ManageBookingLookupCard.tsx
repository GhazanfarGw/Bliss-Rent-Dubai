import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { inputClass } from '@/features/shared/ui/inputClasses'
import { Button } from '@/features/shared/ui/Button'

interface Step {
  title: string
  body: string
}

export interface ManageBookingLookupCardProps {
  query: string
  onQueryChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  loading: boolean
  notFound: boolean
  errorMessage: string | null
}

/**
 * The Manage Booking page's own lookup UI — built specifically for this
 * page rather than reusing SearchWidget/BookingNavigator's tab-and-pill
 * treatment (the "same car find navigator everywhere" the redesign brief
 * called out). A light, editorial two-column layout instead: numbered
 * steps on one side explaining what happens, the actual field + button on
 * the other. All state and submit handling stay in ManageBookingPage —
 * this component is presentational only, so the lookupBooking() call and
 * every existing view-state branch are completely unchanged.
 */
export function ManageBookingLookupCard({ query, onQueryChange, onSubmit, loading, notFound, errorMessage }: ManageBookingLookupCardProps) {
  const { t } = useTranslation()
  const steps = t('manageBooking.steps', { returnObjects: true }) as Step[]

  return (
    <div className="-mt-16 overflow-hidden border border-[#ece7df] bg-white shadow-[0_30px_70px_rgba(17,20,29,0.1)] sm:-mt-20 lg:grid lg:grid-cols-5">
      <div className="bg-surface-warm-alt p-6 sm:p-8 lg:col-span-2 lg:p-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-gold-dark">{t('manageBooking.eyebrow')}</p>
        <ol className="mt-5 space-y-6">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-brand-gold/40 text-sm font-bold text-brand-gold-dark">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-brand-navy">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="p-6 sm:p-8 lg:col-span-3 lg:p-10">
        <h2 className="text-xl font-black tracking-[-0.04em] text-brand-navy sm:text-2xl">{t('manageBooking.formHeading')}</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">{t('manageBooking.formIntro')}</p>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">{t('manageBooking.queryLabel')}</span>
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4.5 w-4.5 text-text-muted" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="BLS-XXXXXXXX or ABC-123"
                className={inputClass() + ' ps-10'}
                autoComplete="off"
              />
            </div>
          </label>

          <Button type="submit" loading={loading} fullWidthOnMobile>
            {loading ? t('manageBooking.checking') : t('manageBooking.submit')}
          </Button>

          {notFound && (
            <p className="rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">{t('manageBooking.notFound')}</p>
          )}
          {errorMessage && (
            <p className="rounded-lg border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{errorMessage}</p>
          )}
        </form>
      </div>
    </div>
  )
}
