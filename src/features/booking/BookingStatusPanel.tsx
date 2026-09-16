import { useState, type ComponentType, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Hash, UserRound, Car, CalendarClock, Search } from 'lucide-react'
import { Button } from '@/features/shared/ui/Button'
import { inputClass } from '@/features/shared/ui/inputClasses'
import { lookupBooking, BookingLookupError } from '@/features/booking/lookupApi'
import { toBookingStatusSummary, type BookingStatusSummary } from '@/features/booking/bookingStatusView'

type ViewState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'error'; message: string }
  | { status: 'found'; summary: BookingStatusSummary }

/**
 * Phase 11 correction — the homepage navigator's Booking Status tab. A
 * separate, intentionally minimal option from Manage Booking: only the
 * booking reference is required (matching the existing single-field
 * `lookupBooking()` RPC exactly — no new verification logic at all here),
 * and the result shows only Client Name / Car / Car Number / Days Left —
 * never payment, pricing, or full booking details. See
 * bookingStatusView.ts for the pure reduction from the full lookup result.
 */
export function BookingStatusPanel() {
  const { t } = useTranslation()
  const [reference, setReference] = useState('')
  const [state, setState] = useState<ViewState>({ status: 'idle' })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!reference.trim()) {
      setState({ status: 'error', message: t('home.navigator.status.errorRequired') })
      return
    }

    setState({ status: 'checking' })
    try {
      const result = await lookupBooking(reference)
      if (result) {
        setState({ status: 'found', summary: toBookingStatusSummary(result) })
      } else {
        setState({ status: 'error', message: t('home.navigator.status.errorNotFound') })
      }
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof BookingLookupError ? err.message : t('home.navigator.status.errorGeneric'),
      })
    }
  }

  if (state.status === 'found') {
    const { summary } = state
    return (
      <div>
        <h2 className="font-hero-serif text-3xl font-semibold tracking-[-0.04em] text-brand-navy sm:text-4xl">{t('home.navigator.status.heading')}</h2>
        <div className="mt-6 space-y-3 rounded-2xl border border-brand-gold/20 bg-[linear-gradient(180deg,#ffffff_0%,#f9f5f1_100%)] p-5">
          <StatusRow icon={UserRound} label={t('home.navigator.status.result.clientName')} value={summary.clientName} />
          <StatusRow icon={Car} label={t('home.navigator.status.result.carName')} value={summary.carName} />
          <StatusRow icon={Hash} label={t('home.navigator.status.result.carNumber')} value={summary.carNumber} />
          <StatusRow
            icon={CalendarClock}
            label={t('home.navigator.status.result.daysLeft')}
            value={t('home.navigator.status.result.daysLeftValue', { count: summary.daysLeft })}
          />
        </div>
        <button
          type="button"
          onClick={() => setState({ status: 'idle' })}
          className="mt-4 text-sm font-semibold text-brand-navy underline decoration-brand-gold decoration-2 underline-offset-4"
        >
          {t('home.navigator.status.result.checkAnother')}
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-hero-serif text-3xl font-semibold tracking-[-0.04em] text-brand-navy sm:text-4xl">{t('home.navigator.status.heading')}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">{t('home.navigator.status.intro')}</p>

      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('home.navigator.status.referenceLabel')}
          </span>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t('home.navigator.status.referencePlaceholder')}
            className={inputClass()}
            autoComplete="off"
          />
        </label>
        <Button type="submit" loading={state.status === 'checking'} fullWidthOnMobile>
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.status === 'checking' ? t('home.navigator.status.checking') : t('home.navigator.status.submit')}
        </Button>
      </form>

      {state.status === 'error' && (
        <p className="mt-3 rounded-2xl border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{state.message}</p>
      )}
    </div>
  )
}

function StatusRow({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-brand-navy/8 pb-3 text-sm last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-text-muted">
        <Icon className="h-4 w-4 shrink-0 text-brand-gold-dark" aria-hidden={true} />
        {label}
      </span>
      <span className="text-right font-semibold text-brand-navy">{value}</span>
    </div>
  )
}
