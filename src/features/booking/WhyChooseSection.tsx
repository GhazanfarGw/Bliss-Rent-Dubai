import { useTranslation } from 'react-i18next'
import { CalendarCheck, CalendarRange, KeyRound, MapPinned } from 'lucide-react'

interface WhyChooseItem {
  title: string
  body: string
}

const ITEM_ICONS = [CalendarCheck, MapPinned, CalendarRange, KeyRound]

export function WhyChooseSection() {
  const { t } = useTranslation()
  const items = t('home.whyChoose.items', { returnObjects: true }) as WhyChooseItem[]

  return (
    <section id="why-choose" className="relative isolate scroll-mt-20 overflow-hidden text-brand-navy">
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20 lg:px-8 lg:py-28">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-brand-gold-dark">
            {t('home.whyChoose.eyebrow')}
          </p>
          <h2 className="font-hero-serif mt-5 max-w-xl text-4xl font-semibold leading-[1.02] tracking-[-0.06em] text-brand-navy sm:text-5xl">
            {t('home.whyChoose.title')}
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-7 text-text-muted sm:text-base">
            {t('home.whyChoose.subtitle')}
          </p>
          <div className="mt-8 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-navy/50">
            <span className="h-px w-12 bg-brand-gold" aria-hidden="true" />
            {t('home.whyChoose.note')}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item, index) => {
            const Icon = ITEM_ICONS[index] ?? CalendarCheck
            return (
              <article key={item.title} className="white-box group min-h-64 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center border border-brand-gold/30 bg-brand-gold/5 text-brand-gold transition-colors group-hover:bg-brand-gold group-hover:text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold tracking-[0.18em] text-brand-navy/30">0{index + 1}</span>
                </div>
                <h3 className="mt-10 text-lg font-semibold tracking-[-0.015em] text-brand-navy">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-text-muted">{item.body}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
