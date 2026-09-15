import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckoutSummaryCard } from '@/features/booking/checkout/CheckoutSummaryCard'
import type { Location, VehicleWithDetails } from '@/types/domain'

interface CheckoutStepLayoutProps {
  stepIndex: number // 0-based index into the translated steps list
  title: string
  vehicle: VehicleWithDetails
  startDate: string
  endDate: string
  pickup: Location | null
  dropoff: Location | null
  children: ReactNode
}

/**
 * Checkout progress stepper (brief item 11): a compact "Step X of Y"
 * progress bar on mobile so it never eats vertical space above the fold,
 * and a full icon stepper (done / active / upcoming, connected by a
 * fill-as-you-go line) from `sm` up. Icons are the same hand-authored
 * inline-SVG style used everywhere else in the app (NavBar, AdminLayout)
 * — no icon library.
 */
export function CheckoutStepLayout({
  stepIndex,
  title,
  vehicle,
  startDate,
  endDate,
  pickup,
  dropoff,
  children,
}: CheckoutStepLayoutProps) {
  const { t } = useTranslation()
  const steps = t('checkout.steps', { returnObjects: true }) as string[]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <CheckoutStepper steps={steps} stepIndex={stepIndex} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h1 className="text-xl font-semibold text-brand-navy">{title}</h1>
          <div className="mt-5">{children}</div>
        </div>
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <CheckoutSummaryCard vehicle={vehicle} startDate={startDate} endDate={endDate} pickup={pickup} dropoff={dropoff} />
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckoutStepper({ steps, stepIndex }: { steps: string[]; stepIndex: number }) {
  const { t } = useTranslation()
  const progressPercent = steps.length > 1 ? Math.round((stepIndex / (steps.length - 1)) * 100) : 0

  return (
    <nav className="mb-8" aria-label={t('checkout.stepperLabel')}>
      {/* Mobile: a compact fill bar + "Step X of Y" text — never more than one line. */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between text-xs font-semibold text-brand-navy">
          <span>{t('checkout.stepOfTotal', { current: stepIndex + 1, total: steps.length })}</span>
          <span className="text-text-muted">{steps[stepIndex]}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-none bg-surface-muted" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-none bg-brand-gold transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* sm and up: full icon stepper with a fill-as-you-go connecting line. */}
      <ol className="hidden items-center sm:flex">
        {steps.map((step, i) => {
          const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'upcoming'
          return (
            <li key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <StepIcon state={state} number={i + 1} />
                <span
                  className={
                    'whitespace-nowrap text-[11px] font-semibold ' +
                    (state === 'upcoming' ? 'text-text-muted' : 'text-brand-navy')
                  }
                >
                  {step}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="mx-2 h-0.5 flex-1 rounded-none bg-surface-muted" aria-hidden="true">
                  <div
                    className="h-full rounded-none bg-brand-gold transition-all duration-300"
                    style={{ width: i < stepIndex ? '100%' : '0%' }}
                  />
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
  if (state === 'done') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none bg-brand-gold text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3.5 w-3.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  return (
    <span
      className={
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-none text-[11px] font-bold ' +
        (state === 'active' ? 'bg-brand-gold text-white ring-4 ring-brand-gold/15' : 'bg-surface-muted text-text-muted')
      }
    >
      {number}
    </span>
  )
}
