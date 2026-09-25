import { useTranslation } from 'react-i18next'
import { CalendarSearch, Car, Check, ChevronRight, IdCard } from 'lucide-react'

interface Step {
  title: string
  body: string
}

const STEP_ICONS = [CalendarSearch, Car, IdCard, Check]

/** A static four-step path that mirrors the real booking flow. Keeping the
 * whole path visible is easier to understand than revealing pieces on scroll,
 * especially on smaller screens and for reduced-motion users. */
export function HowItWorksSection() {
  const { t } = useTranslation()
  const steps = t('home.howItWorks.steps', { returnObjects: true }) as Step[]

  return (
    <section id="how-it-works" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:items-end lg:gap-16">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-brand-gold-dark">
              {t('home.howItWorks.eyebrow')}
            </p>
            <h2 className="font-hero-serif mt-4 text-4xl font-semibold tracking-[-0.06em] text-brand-navy sm:text-5xl">
              {t('home.howItWorks.title')}
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-text-muted sm:text-base lg:justify-self-end lg:text-end">
            {t('home.howItWorks.subtitle')}
          </p>
        </div>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-0">
          {steps.map((step, index) => {
            const Icon = STEP_ICONS[index] ?? Check
            return (
              <li key={step.title} className="group relative border border-[#e7e2da] bg-surface-warm p-6 sm:min-h-72 lg:border-e-0 lg:p-7 lg:last:border-e">
                <div className="flex items-center justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center bg-brand-navy text-white transition-colors group-hover:bg-brand-gold">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-hero-serif text-3xl font-semibold text-brand-gold/35">0{index + 1}</span>
                </div>
                <div className="mt-12 h-px w-10 bg-brand-gold" aria-hidden="true" />
                <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-brand-navy">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-text-muted">{step.body}</p>

                {index < steps.length - 1 && (
                  <span className="absolute -end-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center border border-[#e7e2da] bg-white text-brand-gold-dark lg:flex">
                    <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
