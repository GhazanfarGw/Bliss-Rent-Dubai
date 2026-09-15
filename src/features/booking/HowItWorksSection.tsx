import { useTranslation } from 'react-i18next'
import { Car, CalendarSearch, CreditCard, IdCard } from 'lucide-react'

interface Step {
  title: string
  body: string
}

/**
 * The real customer journey — choose dates/location, select a vehicle,
 * enter customer/driver details, complete booking/payment — all online.
 * Doubles as the header's "Services" anchor target.
 *
 * Each step keeps its sequence number (this is an ordered process, unlike
 * WhyChooseSection's unordered feature list right above it) but also gets
 * a distinct icon matched to what that step actually is, so the two
 * sections don't read as the same plain numbered-badge pattern repeated
 * twice on one page.
 */
const STEP_ICONS = [CalendarSearch, Car, IdCard, CreditCard]

export function HowItWorksSection() {
  const { t } = useTranslation()
  const steps = t('home.howItWorks.steps', { returnObjects: true }) as Step[]

  return (
    <section id="how-it-works" className="scroll-mt-20 bg-surface-warm">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-hero-serif text-3xl font-black tracking-[-0.06em] text-brand-navy sm:text-4xl">{t('home.howItWorks.title')}</h2>
          <p className="mt-3 text-sm leading-6 text-text-muted">{t('home.howItWorks.subtitle')}</p>
        </div>

        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => {
            const Icon = STEP_ICONS[i] ?? Car
            return (
              <li
                key={step.title}
                className="group relative rounded-none border border-[#e8dcc6] bg-white p-5 shadow-(--shadow-card) transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold/40 hover:shadow-(--shadow-card-hover)"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-brand-gold text-sm font-bold text-[#fff] shadow-[0_12px_24px_rgba(92,9,49,0.18)] transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_0_6px_rgba(212,175,55,0.2)]">
                    {i + 1}
                  </span>
                  <Icon className="h-6 w-6 text-brand-gold" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-brand-navy">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-text-muted">{step.body}</p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
