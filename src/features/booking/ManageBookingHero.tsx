import { useTranslation } from 'react-i18next'
import { HERO_SLIDE_IMAGES } from '@/features/booking/heroSlides'
import { PageHero } from '@/features/shared/ui/PageHero'

// Reuses one of the homepage hero's own real vehicle photos (index 1: the
// sedan shot) rather than a new/invented image — just a different index
// than Hero.tsx's HERO_SLIDE_INDEX (4) and BookCarPage's (2), so each page
// reads as its own place rather than a repeat of the others.
const MANAGE_BOOKING_IMAGE_INDEX = 1

/**
 * The Manage Booking page's own hero, built on the shared `PageHero`
 * primitive (see src/features/shared/ui/PageHero.tsx) — distinct from the
 * homepage's full-bleed Hero and from the plain color-strip banner other
 * content pages use (About, Car Types, …). Manage Booking gets the fuller
 * treatment because, unlike a static info page, it's a real task a guest
 * lands on directly from an email link — it deserves to feel like a
 * proper destination, not an afterthought.
 */
export function ManageBookingHero() {
  const { t } = useTranslation()
  const image = HERO_SLIDE_IMAGES[MANAGE_BOOKING_IMAGE_INDEX]

  return (
    <PageHero
      imageSrc={image.src}
      imageAlt={t(image.altKey)}
      badge={t('manageBooking.heroBadge')}
      title={t('manageBooking.title')}
      subtitle={t('manageBooking.subtitle')}
    />
  )
}
