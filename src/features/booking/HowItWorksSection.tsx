import { useTranslation } from 'react-i18next'

interface Step {
  title: string
  body: string
}

/**
 * The real customer journey — choose dates/location, select a vehicle,
 * enter customer/driver details, complete booking/payment — all online.
 * Doubles as the header's "Services" anchor target.
 */
export function HowItWorksSection() {
  const { t } = useTranslation()
  const steps = t('home.howItWorks.steps', { returnObjects: true }) as Step[]

  return (
    <section id="how-it-works" className="scroll-mt-20 bg-[#f6f3ee]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-black tracking-[-0.06em] text-brand-navy sm:text-4xl">{t('home.howItWorks.title')}</h2>
          <p className="mt-3 text-sm leading-6 text-text-muted">{t('home.howItWorks.subtitle')}</p>
        </div>

        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="group relative rounded-[1.5rem] border border-[#e8dcc6] bg-white p-5 shadow-[0_18px_36px_rgba(16,20,29,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold/40 hover:shadow-[0_26px_54px_rgba(16,20,29,0.1)]"
            >
              <span className="flex h-11 w-11 items-center justify-center bg-brand-gold text-sm font-bold text-[#fff] shadow-[0_12px_24px_rgba(92,9,49,0.18)] transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_0_6px_rgba(212,175,55,0.2)]">
                {i + 1}
              </span>
              <h3 className="mt-4 text-sm font-semibold text-brand-navy">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
