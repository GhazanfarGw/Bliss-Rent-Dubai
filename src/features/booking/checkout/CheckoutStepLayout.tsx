import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ActionsSlotContext } from '@/features/booking/checkout/CheckoutActions'
import { CheckoutSummaryCard } from '@/features/booking/checkout/CheckoutSummaryCard'
import { CurrencySymbol } from '@/features/shared/ui/CurrencySymbol'
import { rentalDays } from '@/lib/dateRange'
import { quoteForDays } from '@/lib/pricing'
import type { Location, VehicleWithDetails } from '@/types/domain'

export interface CheckoutTotal {
  label: string
  amount: number
  currency: string
  detail?: string
}

interface CheckoutStepLayoutProps {
  stepIndex: number
  title: string
  vehicle: VehicleWithDetails
  startDate: string
  endDate: string
  pickup: Location | null
  dropoff: Location | null
  /** The saved booking amount takes precedence over the live estimate. */
  total?: CheckoutTotal
  showTripInCard?: boolean
  children: ReactNode
}

/** One action row: in the form's flow on desktop, fixed within reach on mobile. */
export function CheckoutStepLayout({
  stepIndex, title, vehicle, startDate, endDate, pickup, dropoff, total,
  showTripInCard = true, children,
}: CheckoutStepLayoutProps) {
  const { t } = useTranslation()
  const steps = t('checkout.steps', { returnObjects: true }) as string[]
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const days = rentalDays(startDate, endDate)
  const quote = quoteForDays(vehicle.pricing, days)
  const actionTotal = total ?? (quote ? {
    label: t('checkout.summaryCard.estimatedTotal'),
    amount: quote.totalPrice,
    currency: quote.currency,
  } : null)

  return (
    <ActionsSlotContext.Provider value={slot}>
      <div className="checkout-layout mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-5 lg:px-8">
        <MobileStepBar steps={steps} stepIndex={stepIndex} />
        <CheckoutStepper steps={steps} stepIndex={stepIndex} />
        <h1 className="mb-3 border-s-2 border-brand-gold ps-3 font-hero-serif text-2xl font-semibold tracking-[-0.04em] text-brand-navy sm:mb-4 sm:text-3xl">{title}</h1>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-5">
          <div className="order-2 min-w-0 lg:order-1">
            {children}
            <ActionBar total={actionTotal} setSlot={setSlot} />
          </div>
          <div className="checkout-card-sticky order-1 min-w-0 lg:order-2">
            <CheckoutSummaryCard vehicle={vehicle} startDate={startDate} endDate={endDate} pickup={pickup} dropoff={dropoff} showTrip={showTripInCard} total={total} />
          </div>
        </div>
      </div>
    </ActionsSlotContext.Provider>
  )
}

function ActionBar({ total, setSlot }: {
  total: CheckoutTotal | null
  setSlot: (el: HTMLElement | null) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)

  // Only the fixed mobile bar needs page clearance and an offset for support chat.
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const publish = () => {
      const height = getComputedStyle(bar).position === 'fixed' ? bar.offsetHeight : 0
      document.documentElement.style.setProperty('--checkout-bar-h', `${height}px`)
    }
    publish()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish)
    observer?.observe(bar)
    window.addEventListener('resize', publish)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', publish)
      document.documentElement.style.removeProperty('--checkout-bar-h')
    }
  }, [])

  return (
    <div ref={barRef} data-testid="checkout-actions" className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-navy/10 bg-white shadow-[0_-4px_20px_rgba(7,10,26,0.06)] lg:static lg:mt-4 lg:shadow-none">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-0 lg:py-3">
        {total && (
          <div className="min-w-0 max-w-[32%] sm:max-w-none lg:me-auto">
            <p className="text-[10px] font-semibold leading-tight text-brand-gold-dark sm:text-xs">{total.label}</p>
            <p className="mt-1 text-base font-bold leading-tight text-brand-navy sm:text-xl"><CurrencySymbol currency={total.currency} /> {total.amount.toLocaleString()}</p>
          </div>
        )}
        <div ref={setSlot} className="ms-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3 lg:flex-none" />
      </div>
    </div>
  )
}

function MobileStepBar({ steps, stepIndex }: { steps: string[]; stepIndex: number }) {
  const { t } = useTranslation()
  const progressPercent = Math.round(((stepIndex + 1) / steps.length) * 100)
  return (
    <nav className="sticky top-[var(--header-h)] z-20 -mx-4 mb-3 border-b border-brand-navy/10 bg-white px-4 py-2 sm:hidden" aria-label={t('checkout.stepperLabel')}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-brand-navy">
        <span>{t('checkout.stepOfTotal', { current: stepIndex + 1, total: steps.length })}</span>
        <span className="text-text-muted">{steps[stepIndex]}</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden bg-surface-muted" role="progressbar" aria-label={t('checkout.stepperLabel')} aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-brand-gold transition-all duration-300 motion-reduce:transition-none" style={{ width: `${progressPercent}%` }} />
      </div>
    </nav>
  )
}

function CheckoutStepper({ steps, stepIndex }: { steps: string[]; stepIndex: number }) {
  const { t } = useTranslation()
  return (
    <nav className="mb-4 hidden sm:block" aria-label={t('checkout.stepperLabel')}>
      <ol className="flex items-center">
        {steps.map((step, i) => {
          const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'upcoming'
          return (
            <li key={step} className="flex flex-1 items-center last:flex-none" aria-current={state === 'active' ? 'step' : undefined}>
              <div className="flex items-center gap-2">
                <StepIcon state={state} number={i + 1} />
                <span className={'text-xs font-semibold ' + (state === 'upcoming' ? 'text-text-muted' : 'text-brand-navy')}>{step}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="mx-3 h-px flex-1 bg-surface-muted" aria-hidden="true">
                  <div className="h-full bg-brand-gold" style={{ width: i < stepIndex ? '100%' : '0%' }} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function StepIcon({ state, number }: { state: 'done' | 'active' | 'upcoming'; number: number }) {
  return (
    <span className={'flex h-7 w-7 shrink-0 items-center justify-center text-[11px] font-bold ' + (state === 'upcoming' ? 'bg-surface-muted text-text-muted' : 'bg-brand-gold text-white')}>
      {state === 'done' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3.5 w-3.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : number}
    </span>
  )
}
