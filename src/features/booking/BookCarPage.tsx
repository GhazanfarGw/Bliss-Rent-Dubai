import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SearchWidget } from '@/features/booking/SearchWidget'
import { HERO_SLIDE_IMAGES } from '@/features/booking/heroSlides'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { PageHero } from '@/features/shared/ui/PageHero'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import type { SearchCriteria } from '@/types/domain'

// A different real hero photo than the homepage (index 4) and Manage
// Booking (index 1), so this page reads as its own place — the SUV shot.
const BOOK_CAR_IMAGE_INDEX = 2

/**
 * A standalone "start a booking" destination, separate from the homepage
 * hero's embedded BookingNavigator and from /search's own compact
 * "edit search" bar — built from the exact same underlying pieces
 * (CitySelect, LocationPickerButton, DateRangePicker, TimeSelect, all via
 * SearchWidget's `layout="card"` variant) rather than a new, duplicated
 * form. Submitting calls the SAME `onSearch` → `/search?...` flow as the
 * homepage's BookingSearchSection — no new backend logic, no new
 * validation, just a page-appropriate presentation of the existing one.
 */
export function BookCarPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('bookCar.title'))
  useMetaDescription(t('bookCar.subtitle'))
  const navigate = useNavigate()
  const image = HERO_SLIDE_IMAGES[BOOK_CAR_IMAGE_INDEX]

  function handleSearch(criteria: SearchCriteria) {
    navigate({ pathname: '/search', search: criteriaToSearchParams(criteria).toString() })
  }

  return (
    <div className="bg-white">
      <PageHero
        imageSrc={image.src}
        imageAlt={t(image.altKey)}
        badge={t('bookCar.heroBadge')}
        title={t('bookCar.title')}
        subtitle={t('bookCar.subtitle')}
      />

      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8 mt-28 md:32">
        <div className="-mt-16 sm:-mt-20">
          <SearchWidget layout="card" onSearch={handleSearch} />
        </div>
      </div>
    </div>
  )
}
