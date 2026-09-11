import { useTranslation } from 'react-i18next'
import { HERO_SLIDE_IMAGES } from '@/features/booking/heroSlides'
import { PageHero } from '@/features/shared/ui/PageHero'

// A different real hero photo than the homepage (index 4), Manage Booking
// (index 1), and Book a Car (index 2) — the economy shot — so this page
// reads as its own place rather than a repeat of the others.
const FIND_MY_CAR_IMAGE_INDEX = 0

/**
 * The Find My Car page's own hero, built on the shared `PageHero`
 * primitive — the same treatment ManageBookingHero uses, but for the
 * separate, read-only "check my booking status" destination. Find My Car
 * and Manage Booking used to be a single page; they are now two distinct
 * pages (see FindMyCarPage.tsx / ManageBookingPage.tsx) so a guest who
 * only wants a quick status check is never shown extend/payment actions.
 */
export function FindMyCarHero() {
  const { t } = useTranslation()
  const image = HERO_SLIDE_IMAGES[FIND_MY_CAR_IMAGE_INDEX]

  return (
    <PageHero
      imageSrc={image.src}
      imageAlt={t(image.altKey)}
      badge={t('findMyCar.heroBadge')}
      title={t('findMyCar.title')}
      subtitle={t('findMyCar.subtitle')}
    />
  )
}
