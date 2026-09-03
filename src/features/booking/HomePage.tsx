import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Hero } from '@/features/booking/Hero'
import { TickerBar } from '@/features/booking/TickerBar'
import { BrandsMarquee } from '@/features/booking/BrandsMarquee'
import { BookingSearchSection } from '@/features/booking/BookingSearchSection'
import { WhyChooseSection } from '@/features/booking/WhyChooseSection'
import { RequirementsSection } from '@/features/booking/RequirementsSection'
import { LocationsPreviewSection } from '@/features/booking/LocationsPreviewSection'
import { FeaturedVehicles } from '@/features/booking/FeaturedVehicles'
import { HowItWorksSection } from '@/features/booking/HowItWorksSection'
import { VehicleCategoriesSection } from '@/features/booking/VehicleCategoriesSection'
import { HomeFaqSection } from '@/features/booking/HomeFaqSection'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import type { SearchCriteria } from '@/types/domain'

/**
 * Section order per the Phase 4 spec: Header (Layout) -> full-width Hero ->
 * Booking Search -> Brands marquee -> live categories -> featured vehicles ->
 * Why Choose Bliss Rent -> Requirements -> locations -> How It Works -> FAQ ->
 * final booking CTA -> Footer. The old value-props grid is now
 * WhyChooseSection. The multi-slide HeroCarousel (Phase 4.1) was replaced
 * per the Phase 11 header/hero redesign with Hero, a single static image
 * with the header transparently overlaid on top of it.
 */
export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const premiumHighlights = t('home.premiumHighlights.items', { returnObjects: true }) as Array<{ title: string; body: string }>

  function handleSearch(criteria: SearchCriteria) {
    navigate({ pathname: '/search', search: criteriaToSearchParams(criteria).toString() })
  }

  return (
    <div className="bg-[#f6f3ee] text-brand-navy">
      <TickerBar />
      <Hero />
      <BookingSearchSection onSearch={handleSearch} />

      <section className="bg-[#f8f5f0] py-12 text-brand-navy sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold-dark">{t('home.premiumHighlights.eyebrow')}</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.06em] text-brand-navy sm:text-4xl">{t('home.premiumHighlights.title')}</h2>
            <p className="mt-3 text-sm leading-7 text-text-muted sm:text-base">{t('home.premiumHighlights.subtitle')}</p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {premiumHighlights.map((item, index) => (
              <div key={item.title} className="border border-[#ece7df] bg-white p-5 shadow-none">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-none bg-brand-gold text-base font-black text-white shadow-none">
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

      <div className="bg-[#f6f3ee]">
        <VehicleCategoriesSection />
        <FeaturedVehicles />
        <WhyChooseSection />
        <RequirementsSection />
        <LocationsPreviewSection />
        <HowItWorksSection />
        <HomeFaqSection />

        <section className="bg-[#f7f4ef] px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl border border-[#ece7df] bg-white p-8 shadow-none sm:p-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold-dark">Fleet choices, simplified</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.06em] text-brand-navy sm:text-5xl">{t('home.finalCta.title')}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">{t('home.finalCta.subtitle')}</p>
            <button
              type="button"
              onClick={() => document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="mt-8 inline-flex min-h-12 items-center bg-brand-gold px-6 py-3 text-sm font-bold text-white shadow-none transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand-gold focus:ring-offset-2 focus:ring-offset-white"
            >
              {t('home.finalCta.button')}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
