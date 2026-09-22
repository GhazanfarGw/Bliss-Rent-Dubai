import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChevronDown, MapPin } from 'lucide-react'
import { VehicleHighlights } from '@/features/booking/VehicleHighlights'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import type { CheckoutTotal } from '@/features/booking/checkout/CheckoutStepLayout'
import { CurrencySymbol } from '@/features/shared/ui/CurrencySymbol'
import { primaryImage } from '@/lib/vehicleImages'
import { quoteForDays, TERM_LABELS } from '@/lib/pricing'
import { rentalDays } from '@/lib/dateRange'
import { engineLabel, highlightItems } from '@/lib/vehicleSpecs'
import type { Location, VehicleWithDetails } from '@/types/domain'

interface CheckoutSummaryCardProps {
  vehicle: VehicleWithDetails
  startDate: string
  endDate: string
  pickup: Location | null
  dropoff: Location | null
  /** Earlier steps already show the trip in their main content. */
  showTrip?: boolean
  /** Payment and resumed bookings supply the authoritative amount due. */
  total?: CheckoutTotal
}

/** Keep the car, rental duration and total visible above the form on mobile,
 * as a compact row beside a small photo. Supporting facts expand on request.
 * Desktop has room for a full-width photo above the details, always shown. */
export function CheckoutSummaryCard({ vehicle, startDate, endDate, pickup, dropoff, showTrip = true, total }: CheckoutSummaryCardProps) {
  const { t } = useTranslation()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsId = useId()
  const image = primaryImage(vehicle)
  const days = rentalDays(startDate, endDate)
  const quote = quoteForDays(vehicle.pricing, days)
  const hasDetails = Boolean(showTrip || highlightItems(t, vehicle).length || engineLabel(vehicle) || (total ? total.detail : quote))
  const amount = total?.amount ?? quote?.totalPrice
  const currency = total?.currency ?? quote?.currency

  return (
    <aside aria-label={t('checkout.summaryCard.vehicleLabel')} className="overflow-hidden border border-brand-navy/10 bg-white shadow-[0_12px_35px_rgba(7,10,26,0.07)]">
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] sm:grid-cols-[8rem_minmax(0,1fr)] lg:grid-cols-1">
        <div className="relative min-h-24 bg-surface-muted lg:aspect-16/10 lg:min-h-0">
          <VehiclePhoto
            storagePath={image?.storage_path ?? null}
            alt={`${vehicle.make} ${vehicle.model}`}
            className="absolute inset-0 h-full w-full rounded-none"
          />
        </div>

        <div className="min-w-0 p-3 lg:p-4">
          <h2 className="font-hero-serif text-lg font-semibold leading-tight tracking-[-0.03em] text-brand-navy sm:text-xl lg:text-xl">
            {vehicle.make} {vehicle.model}
          </h2>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.1em] text-text-muted">
            {vehicle.model_year} · {t(`vehicleCard.transmission.${vehicle.transmission}`, { defaultValue: vehicle.transmission })}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-navy">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-brand-gold-dark" aria-hidden="true" />
            {days} {t(days === 1 ? 'common.day' : 'common.days')}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-brand-gold/15 bg-surface-warm/50 px-3 py-2.5 sm:px-4">
        <div className="min-w-0 text-brand-navy">
          {amount != null && currency ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-gold-dark">
                {total?.label ?? t('checkout.summaryCard.estimatedTotal')}
              </p>
              <p className="mt-1 text-2xl font-bold leading-none tracking-tight">
                <CurrencySymbol currency={currency} /> {amount.toLocaleString()}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-text-muted">{t('checkout.summaryCard.pricingUnavailable')}</p>
          )}
        </div>
        {hasDetails && (
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            onClick={() => setDetailsOpen((open) => !open)}
            className="flex min-h-11 shrink-0 items-center gap-1.5 text-xs font-semibold text-brand-navy underline decoration-brand-gold/50 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-gold lg:hidden"
          >
            {t('vehicleCard.viewDetails')}
            <ChevronDown className={`h-4 w-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        )}
      </div>

      {hasDetails && (
        <div id={detailsId} className={`${detailsOpen ? 'block' : 'hidden'} border-t border-brand-navy/10 px-3 pb-3 sm:px-4 lg:block`}>
          {total ? (
            total.detail && <p className="mt-3 text-xs leading-4 text-text-muted">{total.detail}</p>
          ) : quote ? (
            <p className="mt-3 text-xs leading-4 text-text-muted">
              <CurrencySymbol currency={quote.currency} /> {quote.unitPrice.toLocaleString()} {TERM_LABELS[quote.term]} × {quote.units} · {t('checkout.summaryCard.estimated')}
            </p>
          ) : null}

          <VehicleHighlights vehicle={vehicle} className="mt-3 [&>div]:py-1.5 [&>div>span]:h-6 [&>div>span]:w-6 [&_dd]:text-xs" />

          {showTrip && (
            <>
              <div className="mt-3 grid grid-cols-2 border-y border-brand-navy/10 py-2.5">
                <DateDetail label={t('checkout.summaryCard.pickupDate')} value={startDate} />
                <DateDetail label={t('checkout.summaryCard.dropoffDate')} value={endDate} end />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-3">
                <LocationDetail label={t('checkout.summaryCard.pickup')} value={pickup?.name ?? '—'} />
                <LocationDetail label={t('checkout.summaryCard.dropoff')} value={dropoff?.name ?? '—'} />
              </dl>
            </>
          )}
        </div>
      )}
    </aside>
  )
}

function DateDetail({ label, value, end = false }: { label: string; value: string; end?: boolean }) {
  return (
    <div className={end ? 'min-w-0 border-s border-brand-navy/10 ps-3' : 'min-w-0 pe-3'}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <p className="ltr-nums mt-0.5 text-xs font-semibold text-brand-navy">{value}</p>
    </div>
  )
}

function LocationDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-gold-dark" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">{label}</dt>
        <dd className="mt-0.5 break-words text-xs font-medium leading-4 text-brand-navy">{value}</dd>
      </div>
    </div>
  )
}
