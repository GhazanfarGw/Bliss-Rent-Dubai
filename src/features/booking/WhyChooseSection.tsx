import { useTranslation } from 'react-i18next'
import { CalendarCheck, CalendarRange, KeyRound, LifeBuoy, MapPinned } from 'lucide-react'

interface WhyChooseItem {
  title: string
  body: string
}

/**
 * Real business advantages only — easy online booking, Dubai focus,
 * flexible rental periods, customer-provided driver, customer support.
 * No invented awards, fleet-size claims, or statistics (see home.whyChoose
 * in en.ts/ar.ts). Doubles as the header's "About" anchor target.
 *
 * One icon per item, matched to its real meaning (booking / city /
 * calendar flexibility / self-drive / support) — purely visual, so this
 * section reads differently from HowItWorksSection right below it
 * instead of repeating the same plain numbered badge twice on one page.
 */
const ITEM_ICONS = [CalendarCheck, MapPinned, CalendarRange, KeyRound, LifeBuoy]

export function WhyChooseSection() {
  const { t } = useTranslation()
  const items = t('home.whyChoose.items', { returnObjects: true }) as WhyChooseItem[]

  return (
    <section id="why-choose" className="scroll-mt-20 bg-surface-warm-alt">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-brand-gold-dark">Why travelers choose us</p>
          <h2 className="font-hero-serif mt-4 text-3xl font-black tracking-[-0.06em] text-brand-navy sm:text-4xl">{t('home.whyChoose.title')}</h2>
          <p className="mt-3 text-sm leading-7 text-text-muted sm:text-base">{t('home.whyChoose.subtitle')}</p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => {
            const Icon = ITEM_ICONS[i] ?? CalendarCheck
            return (
              <div
                key={item.title}
                className="group border border-[#ece7df] bg-white p-5 shadow-none backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold/40 hover:shadow-[0_24px_48px_rgba(92,9,49,0.1)]"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-none bg-brand-gold text-white shadow-none transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_0_6px_rgba(212,175,55,0.18)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-semibold text-brand-navy">{item.title}</h3>
                </div>
                <p className="mt-4 text-sm leading-7 text-text-muted">{item.body}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
