import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Cog, MessageCircle, Users } from 'lucide-react'
import type { VehicleWithDetails } from '@/types/domain'
import type { PricingTerm } from '@/types/database'
import { primaryImage } from '@/lib/vehicleImages'
import { quoteForDays, cheapestHeadlineRate } from '@/lib/pricing'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import { whatsappUrlForVehicle } from '@/features/booking/contactLinks'

interface VehicleCardProps {
  vehicle: VehicleWithDetails
  /** Rental length in days, when the customer already has dates selected (search results). */
  days?: number
  detailHref: string
  /** Featured homepage cards use a focused hover CTA; search cards retain
   * the full persistent action row. */
  featured?: boolean
  /**
   * Only set on dated search results (see VehicleSearchResult) — `false`
   * means this vehicle has an overlapping booking for the searched dates.
   * It still renders (so the fleet stays browsable) but as "Reserved"
   * instead of a bookable price.
   */
  isAvailable?: boolean
  /**
   * Task 1 (2026-09-11 scoped update) — set when this card represents a
   * group of identical master listings (same Make + Model + Year, each
   * with a valid price and image — see groupPublicVehicles in
   * src/lib/vehicleGrouping.ts). Omitted (or 1) renders exactly as
   * before; 2+ shows a small "x N available" quantity badge, the only
   * card-design change this task makes.
   */
  quantity?: number
}

/** Translated (not hardcoded) per-term unit labels — see vehicleCard.* in en.ts/ar.ts. */
const TERM_I18N_KEY: Record<PricingTerm, string> = {
  daily: 'vehicleCard.perDay',
  weekly: 'vehicleCard.perWeek',
  monthly: 'vehicleCard.perMonth',
  '3_month': 'vehicleCard.per3Months',
}

export function VehicleCard({ vehicle, days, detailHref, isAvailable, featured = false, quantity }: VehicleCardProps) {
  const { t } = useTranslation()
  const image = primaryImage(vehicle)
  const reserved = isAvailable === false
  const quote = days != null && !reserved ? quoteForDays(vehicle.pricing, days) : null
  // No dates chosen yet (e.g. Featured Vehicles on the homepage) — show a
  // simple "From <rate>" headline instead of a dated total, using the same
  // pricing data and no separate pricing logic.
  const headlineRate = days == null && !reserved ? cheapestHeadlineRate(vehicle.pricing) : null

  return (
    <div
      className={
        'group relative flex flex-col self-start overflow-hidden rounded-none border bg-white shadow-none ring-1 ring-transparent transition-all duration-200 hover:-translate-y-1 hover:border-brand-gold/60 ' +
        (reserved ? 'border-warning/40' : 'border-brand-navy/10')
      }
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-[#f1e8d7]">
        <VehiclePhoto
          storagePath={image?.storage_path ?? null}
          alt={`${vehicle.make} ${vehicle.model}`}
          className={'h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]' + (reserved ? ' opacity-70 grayscale' : '')}
        />
        {reserved && (
          <span className="absolute end-3 top-3 rounded-none bg-warning-bg px-3 py-1.5 text-xs font-semibold text-warning shadow-none">
            {t('vehicleCard.reserved')}
          </span>
        )}
        {!reserved && !featured && (
          <span className="absolute start-3 top-3 rounded-none bg-white/90 px-3 py-1.5 text-xs font-semibold text-brand-navy shadow-none">
            {t('vehicleCard.available')}
          </span>
        )}
        {!reserved && featured && vehicle.vehicle_categories && (
          <span className="absolute start-3 top-3 rounded bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-brand-gold">
            {vehicle.vehicle_categories.name}
          </span>
        )}
        <a
          href={whatsappUrlForVehicle(`${vehicle.make} ${vehicle.model} ${vehicle.model_year}`)}
          target="_blank"
          rel="noreferrer"
          aria-label={t('vehicleCard.whatsapp')}
          title={t('vehicleCard.whatsapp')}
          onClick={(e) => e.stopPropagation()}
          className="absolute end-3 bottom-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-none bg-success text-white shadow-md transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>

      <div className="flex flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{vehicle.make}</p>
            <h3 className="mt-1 text-lg font-semibold leading-tight text-brand-navy">
              {vehicle.make} {vehicle.model}
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              {vehicle.model_year}
              {quantity != null && quantity > 1 && (
                <span className="ms-2 inline-flex items-center rounded-none bg-brand-navy/8 px-2 py-0.5 text-[11px] font-semibold text-brand-navy">
                  {t('vehicleCard.quantityAvailable', { count: quantity })}
                </span>
              )}
            </p>
          </div>
          {!reserved && vehicle.vehicle_categories && (
            <span className="shrink-0 rounded-none bg-brand-gold/10 px-2.5 py-1 text-[11px] font-medium text-brand-navy">
              {vehicle.vehicle_categories.name}
            </span>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 border-y border-brand-navy/10 py-3 text-xs text-brand-navy/75">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
            <dt className="sr-only">{t('vehicleCard.seats')}</dt>
            <dd>
              {vehicle.seats} {t('vehicleCard.seats')}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <Cog className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
            <dt className="sr-only">{t('vehicleDetail.transmission')}</dt>
            <dd className="capitalize">{t(`vehicleCard.transmission.${vehicle.transmission}`, { defaultValue: vehicle.transmission })}</dd>
          </div>
        </dl>

        <div className="mt-3 flex flex-col gap-3">
          <div>
            {reserved ? (
              <p className="text-xs font-medium text-warning">{t('vehicleCard.reservedForDates')}</p>
            ) : quote ? (
              <>
                <p className="text-xl font-bold tracking-[-0.04em] text-brand-navy">
                  {quote.currency} {quote.totalPrice.toLocaleString()}
                </p>
                <p className="text-xs text-text-muted">
                  {quote.currency} {quote.unitPrice.toLocaleString()} {t(TERM_I18N_KEY[quote.term])} ·{' '}
                  {days} {t(days === 1 ? 'common.day' : 'common.days')}
                </p>
              </>
            ) : headlineRate ? (
              <p className="text-lg font-bold text-brand-navy">
                {t('vehicleCard.from')} {headlineRate.currency} {headlineRate.client_price.toLocaleString()}
                <span className="ms-1 text-xs font-normal text-text-muted">{t(TERM_I18N_KEY[headlineRate.term])}</span>
              </p>
            ) : (
              <p className="text-xs font-medium text-text-muted">{t('vehicleCard.pricingSoon')}</p>
            )}
          </div>
          {!featured && <div className="grid grid-cols-2 gap-2">
            <Link
              to={detailHref}
              className="inline-flex min-h-11 items-center justify-center rounded-none bg-brand-gold px-3 py-2 text-xs font-semibold text-white shadow-none transition-all hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-brand-gold focus:ring-offset-2"
            >
              {reserved ? t('vehicleCard.viewDetails') : t('vehicleCard.bookNow')}
            </Link>
            {!reserved && (
              <Link
                to={detailHref}
                className="inline-flex min-h-11 items-center justify-center rounded-none border border-brand-navy/12 bg-white px-3 py-2 text-xs font-semibold text-brand-navy transition-colors hover:bg-brand-gold/10 focus:outline-none focus:ring-2 focus:ring-brand-gold focus:ring-offset-2"
              >
                {t('vehicleCard.viewDetails')}
              </Link>
            )}
          </div>}
        </div>
      </div>
      {featured && !reserved && (
        <>
          <div className="pointer-events-none absolute inset-0 z-10 bg-brand-navy/75 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100" />
          {/* TEMPORARY (see contactLinks.ts / Task 2): this hover CTA normally
           * deep-links to the booking flow (`to={detailHref}`) — for now it
           * opens the same centralized WhatsApp chat as the card's small
           * always-visible icon button, while bookings are being handled
           * directly over WhatsApp. Styling/layout/animation are unchanged;
           * only the action + icon differ. To revert: swap this <a> back to
           * `<Link to={detailHref}>{t('vehicleCard.bookNow')}<ArrowRight .../></Link>`
           * (re-add `ArrowRight` to the lucide-react import above). */}
          <a
            href={whatsappUrlForVehicle(`${vehicle.make} ${vehicle.model} ${vehicle.model_year}`)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-10 top-1/2 z-20 inline-flex min-h-11 -translate-y-1/2 items-center justify-center gap-3 rounded-none border border-brand-champagne bg-brand-gold px-4 py-3 text-sm font-semibold text-white opacity-0 shadow-[0_12px_28px_rgba(11,19,43,0.3)] transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-navy"
          >
            {t('vehicleCard.whatsapp')}
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </a>
        </>
      )}
    </div>
  )
}
