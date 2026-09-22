import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Hero } from '@/features/booking/Hero'
import { BrandsMarquee } from '@/features/booking/BrandsMarquee'
import { BookingSearchSection } from '@/features/booking/BookingSearchSection'
import { FeaturedVehicles } from '@/features/booking/FeaturedVehicles'
import { HomeBlogSliderSection } from '@/features/booking/HomeBlogSliderSection'
import { HomeFaqSection } from '@/features/booking/HomeFaqSection'
import { HomeJournalSection } from '@/features/booking/HomeJournalSection'
import { HomeJourneyPlannerSection } from '@/features/booking/HomeJourneyPlannerSection'
import { SportsCollectionSection } from '@/features/booking/SportsCollectionSection'
import { LocationsPreviewSection } from '@/features/booking/LocationsPreviewSection'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { ClosingCta } from '@/features/shared/ui/ClosingCta'
import type { SearchCriteria, VehicleWithDetails } from '@/types/domain'

/**
 * The homepage is the commercial front door rather than a shorter copy of
 * About. It moves from booking to live fleet, UAE editorial content, a
 * dedicated sports collection, trip planning, the pick-up/drop-off coverage
 * map (the same LocationsPreviewSection About shows — imported, not copied),
 * a sliding row of blog articles and FAQ. Company values, operating steps
 * and document details stay on About.
 *
 * Every section opens with the same small line-and-label heading (Eyebrow)
 * above its big heading — keep that when adding a section.
 */
export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState<VehicleWithDetails[] | null>(null)
  const [fleetFailed, setFleetFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchAllAvailableVehicles()
      .then((data) => {
        if (!cancelled) setVehicles(data)
      })
      .catch(() => {
        if (!cancelled) setFleetFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleSearch(criteria: SearchCriteria) {
    navigate({ pathname: '/search', search: criteriaToSearchParams(criteria).toString() })
  }

  return (
    <div className="bg-white text-brand-navy">
      <Hero />
      <BookingSearchSection onSearch={handleSearch} />
      <BrandsMarquee />

      <main className="bg-white">
        <FeaturedVehicles vehicles={vehicles} failed={fleetFailed} />
        <HomeJournalSection />
        <SportsCollectionSection vehicles={vehicles} failed={fleetFailed} />
        <HomeJourneyPlannerSection />
        <LocationsPreviewSection />
        <HomeBlogSliderSection />
        <HomeFaqSection />
        <ClosingCta eyebrow={t('home.finalCta.eyebrow')} heading={t('home.finalCta.title')} />
      </main>
    </div>
  )
}
