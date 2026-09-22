import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Calendar, Cog, Gauge, MessageCircle, Users } from 'lucide-react'
import type { VehicleWithDetails } from '@/types/domain'
import type { PricingTerm } from '@/types/database'
import { categoryLabel } from '@/lib/categoryName'
import { primaryImage } from '@/lib/vehicleImages'
import { quoteForDays, cheapestHeadlineRate } from '@/lib/pricing'
import { engineLabel } from '@/lib/vehicleSpecs'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import { whatsappUrlForVehicle } from '@/features/booking/contactLinks'
import { CurrencySymbol } from '@/features/shared/ui/CurrencySymbol'

interface VehicleCardProps {
  vehicle: VehicleWithDetails
  /** Rental length in days, when the customer already has dates selected (search results). */
  days?: number
  detailHref: string
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
  /**
   * Defaults to true. `false` takes every link out of the keyboard tab order
   * (tabIndex -1) while leaving it fully clickable — used for the
   * loop-only duplicate row in the Featured marquee, which must stay
   * mouse/touch-interactive (it is on screen half the loop) but must not
   * add a second set of tab stops.
   */
  focusable?: boolean
}

/*
 * Cards deliberately do NOT lift (`hover:-translate-y-*`) on hover: the card
 * moves out from under a pointer resting near its bottom edge, hover drops, the
 * card settles back, hover returns — and the cursor flickers between arrow and
 * hand. Hover feedback here is border, shadow and photo zoom only, none of which
 * move the hit area.
 */

/** Translated (not hardcoded) per-term unit labels — see vehicleCard.* in en.ts/ar.ts. Exported so other compact vehicle previews (e.g. SiteSearch's car results) can label a rate the same way instead of re-deriving it. */
export const TERM_I18N_KEY: Record<PricingTerm, string> = {
  daily: 'vehicleCard.perDay',
  weekly: 'vehicleCard.perWeek',
  monthly: 'vehicleCard.perMonth',
  '3_month': 'vehicleCard.per3Months',
}

/**
 * The one vehicle card, used everywhere a car is listed — the fleet page, the
 * homepage Featured row and the "similar vehicles" row — so they all look and
 * behave alike. It is compact: the whole card is a single link to the vehicle
 * (the Book now button's stretched hit-area), with the price and that one
 * action in a single footer row, and a WhatsApp shortcut on the photo.
 */
export function VehicleCard({ vehicle, days, detailHref, isAvailable, quantity, focusable = true }: VehicleCardProps) {
  const { t } = useTranslation()
  const tabIndex = focusable ? undefined : -1
  const image = primaryImage(vehicle)
  const engine = engineLabel(vehicle)
  const reserved = isAvailable === false
  const quote = days != null && !reserved ? quoteForDays(vehicle.pricing, days) : null
  // No dates chosen yet (e.g. Featured Vehicles on the homepage) — show a
  // simple "From <rate>" headline instead of a dated total, using the same
  // pricing data and no separate pricing logic.
  const headlineRate = days == null && !reserved ? cheapestHeadlineRate(vehicle.pricing) : null

  return (
    <div
      className={
        'group relative flex flex-col overflow-hidden border bg-white shadow-[0_10px_30px_rgba(7,10,26,0.06)] transition-[border-color,box-shadow] duration-300 hover:border-brand-gold/50 hover:shadow-[0_22px_50px_rgba(7,10,26,0.12)] ' +
        (reserved ? 'border-warning/40' : 'border-brand-navy/10')
      }
    >
      <div className="relative aspect-16/10 overflow-hidden bg-[#eeeae3]">
        <VehiclePhoto
          storagePath={image?.storage_path ?? null}
          alt={`${vehicle.make} ${vehicle.model}`}
          className={'h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]' + (reserved ? ' opacity-70 grayscale' : '')}
        />
        {reserved ? (
          <span className="absolute start-3 top-3 bg-warning-bg px-2 py-1.5 text-[10px] font-medium uppercase leading-none tracking-[0.1em] text-warning shadow-sm">
            {t('vehicleCard.reserved')}
          </span>
        ) : (
          <span className="absolute start-3 top-3 inline-flex items-center gap-1.5 bg-white/95 px-2 py-1.5 text-[10px] font-medium uppercase leading-none tracking-[0.1em] text-brand-navy shadow-sm backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            {t('vehicleCard.available')}
          </span>
        )}
        {quantity != null && quantity > 1 && (
          <span className="absolute bottom-3 start-3 bg-white/95 px-2 py-1.5 text-[11px] font-medium leading-none text-brand-navy shadow-sm backdrop-blur-sm">
            {t('vehicleCard.quantityAvailable', { count: quantity })}
          </span>
        )}
        <a
          href={whatsappUrlForVehicle(`${vehicle.make} ${vehicle.model} ${vehicle.model_year}`)}
          target="_blank"
          rel="noreferrer"
          tabIndex={tabIndex}
          aria-label={t('vehicleCard.whatsapp')}
          title={t('vehicleCard.whatsapp')}
          className="absolute bottom-3 end-3 z-10 inline-flex h-10 w-10 items-center justify-center bg-success text-white shadow-md transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gold-dark">{vehicle.make}</p>
          {vehicle.vehicle_categories && (
            <span className="shrink-0 bg-brand-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-navy">
              {categoryLabel(t, vehicle.vehicle_categories.name)}
            </span>
          )}
        </div>
        {/* Plain sans, medium weight and one line: a long model name must not wrap
            and make this card taller than its neighbours. The full name stays in
            the tooltip if it is ever clipped. */}
        <h3
          title={`${vehicle.make} ${vehicle.model}`}
          className="mt-1.5 truncate text-base font-medium leading-snug text-brand-navy"
        >
          {vehicle.make} {vehicle.model}
        </h3>

        <dl className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-navy/70">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
            <dt className="sr-only">{t('vehicleCard.seats')}</dt>
            <dd>
              {vehicle.seats} {t('vehicleCard.seats')}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Cog className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
            <dt className="sr-only">{t('vehicleDetail.transmission')}</dt>
            <dd className="capitalize">{t(`vehicleCard.transmission.${vehicle.transmission}`, { defaultValue: vehicle.transmission })}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
            <dt className="sr-only">{t('vehicleDetail.year')}</dt>
            <dd>{vehicle.model_year}</dd>
          </div>
          {/* The engine gets its own line (and is clipped to one) so a long description
              cannot make this card taller than its neighbours; the full text is the tooltip.
              Shown only when an engine is recorded. */}
          {engine && (
            <div className="flex w-full items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
              <dt className="sr-only">{t('vehicleSpecs.labels.engine')}</dt>
              <dd className="min-w-0 truncate" title={engine}>
                {engine}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-3 border-t border-brand-navy/10 pt-4">
            <div className="min-w-0">
              {reserved ? (
                <p className="text-xs font-medium text-warning">{t('vehicleCard.reservedForDates')}</p>
              ) : quote ? (
                <>
                  <p className="text-xl font-bold leading-tight tracking-[-0.03em] text-brand-navy">
                    <CurrencySymbol currency={quote.currency} /> {quote.totalPrice.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    <CurrencySymbol currency={quote.currency} /> {quote.unitPrice.toLocaleString()} {t(TERM_I18N_KEY[quote.term])} · {days}{' '}
                    {t(days === 1 ? 'common.day' : 'common.days')}
                  </p>
                </>
              ) : headlineRate ? (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{t('vehicleCard.from')}</p>
                  <p className="text-xl font-bold leading-tight tracking-[-0.03em] text-brand-navy">
                    <CurrencySymbol currency={headlineRate.currency} /> {headlineRate.client_price.toLocaleString()}
                    <span className="ms-1.5 text-xs font-normal tracking-normal text-text-muted">{t(TERM_I18N_KEY[headlineRate.term])}</span>
                  </p>
                </>
              ) : (
                <p className="text-xs font-medium text-text-muted">{t('vehicleCard.pricingSoon')}</p>
              )}
            </div>
            {/* This link's ::after is stretched over the whole card. Hovering the card
                hovers this link, so nothing here may create a containing block for that
                ::after on hover — no filter (brightness/blur), transform, or
                transition-all: with `hover:brightness-105` the ::after shrank to the
                button the moment the card was hovered, hover dropped, it grew back, and
                the cursor and the button flickered endlessly. Colour changes only. */}
            <Link
              to={detailHref}
              tabIndex={tabIndex}
              className={
                'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 px-3.5 text-xs font-semibold transition-colors after:absolute after:inset-0 after:content-[""] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 ' +
                (reserved
                  ? 'border border-brand-navy/15 bg-white text-brand-navy hover:bg-brand-gold/10'
                  : 'bg-brand-gold text-white hover:bg-brand-gold-dark')
              }
            >
              {reserved ? t('vehicleCard.viewDetails') : t('vehicleCard.bookNow')}
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
