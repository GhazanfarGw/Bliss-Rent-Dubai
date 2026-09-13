import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { Hero } from '@/features/booking/Hero'
import { TickerBar } from '@/features/booking/TickerBar'
import { BrandsMarquee } from '@/features/booking/BrandsMarquee'
import { BookingSearchSection } from '@/features/booking/BookingSearchSection'
import { WhyChooseSection } from '@/features/booking/WhyChooseSection'
import { RequirementsSection } from '@/features/booking/RequirementsSection'
import { DocumentsRequiredSection } from '@/features/booking/DocumentsRequiredSection'
import { LocationsPreviewSection } from '@/features/booking/LocationsPreviewSection'
import { FeaturedVehicles } from '@/features/booking/FeaturedVehicles'
import { HowItWorksSection } from '@/features/booking/HowItWorksSection'
import { HomeFaqSection } from '@/features/booking/HomeFaqSection'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import type { SearchCriteria } from '@/types/domain'

/**
 * Section order per the Phase 4 spec: Header (Layout) -> full-width Hero ->
 * Booking Search -> Brands marquee -> live categories -> featured vehicles ->
 * Why Choose Bliss Rent -> Requirements -> Documents required -> locations ->
 * How It Works -> FAQ -> final booking CTA -> Footer. The old value-props
 * grid is now WhyChooseSection. The multi-slide HeroCarousel (Phase 4.1)
 * was replaced per the Phase 11 header/hero redesign with Hero, a single
 * static image with the header transparently overlaid on top of it.
 * DocumentsRequiredSection (also Phase 11) breaks the existing
 * Requirements checklist's driving-license line out into the full
 * resident/visitor document list.
 */
export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const premiumHighlights = t('home.premiumHighlights.items', { returnObjects: true }) as Array<{ title: string; body: string }>

  function handleSearch(criteria: SearchCriteria) {
    navigate({ pathname: '/search', search: criteriaToSearchParams(criteria).toString() })
  }

  return (
    <div className="bg-surface-warm text-brand-navy">
      <TickerBar />
      <Hero />
      <BookingSearchSection onSearch={handleSearch} />

      <section className="bg-surface-warm-alt py-12 text-brand-navy sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold-dark">{t('home.premiumHighlights.eyebrow')}</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.06em] text-brand-navy sm:text-4xl">{t('home.premiumHighlights.title')}</h2>
            <p className="mt-3 text-sm leading-7 text-text-muted sm:text-base">{t('home.premiumHighlights.subtitle')}</p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {premiumHighlights.map((item, index) => (
              <div
                key={item.title}
                className="group relative overflow-hidden border border-[#ece7df] bg-white p-5 shadow-none transition-all duration-300 hover:-translate-y-1 hover:border-brand-gold/40 hover:shadow-[0_24px_48px_rgba(92,9,49,0.12)]"
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-brand-champagne transition-transform duration-300 group-hover:scale-x-100"
                />
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-none bg-brand-gold text-base font-black text-white shadow-none transition-shadow duration-300 group-hover:shadow-[0_0_0_6px_rgba(212,175,55,0.18)]">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-brand-navy">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <BrandsMarquee />

      <div className="bg-surface-warm">
        <FeaturedVehicles />
        <WhyChooseSection />
        <RequirementsSection />
        <DocumentsRequiredSection />
        <LocationsPreviewSection />
        <HowItWorksSection />
        <HomeFaqSection />

        <section className="relative overflow-hidden bg-surface-warm px-4 py-16 text-center sm:px-6 lg:px-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/3 rounded-full bg-brand-champagne/20 blur-3xl"
          />
          <div className="relative mx-auto max-w-4xl border border-[#ece7df] bg-white p-8 shadow-[0_30px_70px_rgba(17,20,29,0.08)] sm:p-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold-dark">Fleet choices, simplified</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.06em] text-brand-navy sm:text-5xl">{t('home.finalCta.title')}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">{t('home.finalCta.subtitle')}</p>
            <button
              type="button"
              onClick={() => document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="group mt-8 inline-flex min-h-12 items-center gap-2 bg-brand-gold px-6 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(92,9,49,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(92,9,49,0.4)] focus:outline-none focus:ring-2 focus:ring-brand-gold focus:ring-offset-2 focus:ring-offset-white"
            >
              {t('home.finalCta.button')}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
