import { useTranslation } from 'react-i18next'
import { ShieldCheck, Zap, Lock } from 'lucide-react'
import { ManageBookingLookupCard, type ManageBookingLookupCardProps } from '@/features/booking/ManageBookingLookupCard'

/**
 * The merged Manage Booking page's header: no stock photo (this project
 * has none of Manage Booking's own, and a generic travel photo never fit
 * a "retrieve my booking" task) and — per the site's own "no solid navy
 * boxes" rule (a first pass here used a full navy band; corrected
 * directly) — no dark band either. Plain white page, a proper heading +
 * trust bullets, then the lookup form inside a `.white-box` card (white,
 * hairline berry border, soft neutral shadow — index.css; the same shell
 * used site-wide instead of solid colour fills).
 *
 * Replaces the two-page split (a photo-hero "Booking Status" page and a
 * flat-text "Manage Booking" page) per a direct merge request — see
 * App.tsx's route history comment for the full story. `formHeading`
 * (the old page's H1) is now the small heading inside the card;
 * `hero.heading` is the page-level H1 above it. ManageBookingPage.tsx
 * only renders this while there's no result yet — once a booking is
 * found, this whole finder gets out of the way instead of sitting above
 * the result as dead weight the visitor has to scroll past.
 */
export function ManageBookingHero(props: ManageBookingLookupCardProps) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-gold-dark">{t('manageBooking.title')}</p>
      <h1 className="font-hero-serif mt-4 max-w-xl text-3xl font-semibold leading-[1.15] tracking-[-0.03em] text-brand-navy sm:text-4xl lg:text-5xl">
        {t('manageBooking.hero.heading')}
      </h1>
      <p className="mt-4 max-w-lg text-sm leading-6 text-text-muted sm:text-base">{t('manageBooking.subtitle')}</p>

      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        <TrustItem icon={ShieldCheck} label={t('manageBooking.hero.trust1')} />
        <TrustItem icon={Zap} label={t('manageBooking.hero.trust2')} />
        <TrustItem icon={Lock} label={t('manageBooking.hero.trust3')} />
      </ul>

      <div className="white-box mt-8 p-6 sm:p-8">
        <h2 className="font-hero-serif text-xl font-semibold tracking-[-0.02em] text-brand-navy sm:text-2xl">{t('manageBooking.formHeading')}</h2>
        <div className="mt-5 sm:mt-6">
          <ManageBookingLookupCard {...props} />
        </div>
      </div>
    </div>
  )
}

function TrustItem({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-xs font-semibold text-brand-navy/80 sm:text-sm">
      <Icon className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
      {label}
    </li>
  )
}
