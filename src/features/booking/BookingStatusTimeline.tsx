import { useTranslation } from 'react-i18next'

/** The happy-path sequence a booking moves through. `cancelled` is a
 *  separate terminal state (can be reached from more than one stage), so
 *  it is never plotted on this line — see the early return below. */
const HAPPY_PATH = ['pending_payment', 'confirmed', 'active', 'completed'] as const

/**
 * A small visual progress track for where a booking stands right now —
 * the "commercial" touch a plain status badge doesn't give you. Modeled on
 * the same proven step-indicator language checkout already uses
 * (CheckoutStepLayout.tsx's `CheckoutStepper`: numbered squares, a
 * checkmark once done, a proportionally-filled connecting line) rather
 * than inventing a new visual idiom, just built as its own small
 * component since the checkout one is wired to checkout's own step
 * labels/aria copy and always-linear steps — this one also has to handle
 * `cancelled`, which can end the booking from more than one stage.
 */
export function BookingStatusTimeline({ status }: { status: string }) {
  const { t } = useTranslation()

  if (status === 'cancelled') {
    return <p className="border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{t('manageBooking.result.cancelledNote')}</p>
  }

  const currentIndex = HAPPY_PATH.indexOf(status as (typeof HAPPY_PATH)[number])

  return (
    <nav aria-label={t('manageBooking.result.timelineLabel')}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold-dark">{t('manageBooking.result.timelineLabel')}</p>
      <ol className="mt-3 flex items-center">
        {HAPPY_PATH.map((stage, index) => {
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'upcoming'
          return (
            <li key={stage} className="flex flex-1 items-center last:flex-none" aria-current={state === 'active' ? 'step' : undefined}>
              <div className="flex items-center gap-2">
                <span className={'flex h-7 w-7 shrink-0 items-center justify-center text-[11px] font-bold ' + (state === 'upcoming' ? 'bg-surface-muted text-text-muted' : 'bg-brand-gold text-white')}>
                  {state === 'done' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3.5 w-3.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span className={'hidden text-xs font-semibold sm:inline ' + (state === 'upcoming' ? 'text-text-muted' : 'text-brand-navy')}>{t(`admin.status.${stage}`)}</span>
              </div>
              {index < HAPPY_PATH.length - 1 && (
                <div className="mx-3 h-px flex-1 bg-surface-muted" aria-hidden="true">
                  <div className="h-full bg-brand-gold" style={{ width: index < currentIndex ? '100%' : '0%' }} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
