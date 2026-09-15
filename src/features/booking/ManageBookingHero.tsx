import { useTranslation } from 'react-i18next'

/**
 * The Manage Booking page's own header. Direct redesign request: this
 * page doesn't need a hero at all — no photo, no PageHero badge/overlay —
 * just a plain, flat header modeled on an airline "manage booking"
 * reference page: a small eyebrow label over a rule, then one large
 * heading in the brand's berry-maroon accent (`brand-gold` — see
 * index.css's palette note: Luxury Berry #5C0931, despite the "gold"
 * identifier) that states the two ways to look a booking up, the same way
 * the reference page's own heading does double duty as both title and
 * field instructions.
 *
 * Replaces the earlier full-bleed photo treatment (PageHero) that every
 * other secondary page still uses — deliberately, per that request: a
 * guest here is trying to get a task done, not previewing the fleet, so
 * the page drops straight into the form instead of a decorative banner.
 */
export function ManageBookingHero() {
  const { t } = useTranslation()

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-champagne-dark">{t('manageBooking.title')}</p>
      <hr className="mt-3 border-brand-navy/15" />

      <h1 className="font-hero-serif mt-6 max-w-2xl text-3xl font-black leading-[1.15] tracking-[-0.04em] text-brand-gold sm:text-4xl">
        {t('manageBooking.formHeading')}
      </h1>
      {/* Full context for screen readers only — sighted users get it from
       *  the heading + the two field placeholders below, matching the
       *  reference page's own economy of visible text. */}
      <p className="sr-only">{t('manageBooking.subtitle')}</p>
    </div>
  )
}
