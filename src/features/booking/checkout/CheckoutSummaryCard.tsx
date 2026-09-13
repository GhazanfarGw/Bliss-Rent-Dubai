import { useTranslation } from 'react-i18next'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import { primaryImage } from '@/lib/vehicleImages'
import { quoteForDays, TERM_LABELS } from '@/lib/pricing'
import { rentalDays } from '@/lib/dateRange'
import type { Location, VehicleWithDetails } from '@/types/domain'

interface CheckoutSummaryCardProps {
  vehicle: VehicleWithDetails
  startDate: string
  endDate: string
  pickup: Location | null
  dropoff: Location | null
}

/**
 * Reused across every checkout step so the customer always sees what
 * they're booking. The price shown here is an ESTIMATE for display only
 * — see src/lib/pricing.ts's own comment. The actual charge is
 * recalculated authoritatively, server-side, when the booking is
 * created (Booking Summary step's "Confirm" action) — never trusted
 * from this or any other client-side calculation.
 */
export function CheckoutSummaryCard({ vehicle, startDate, endDate, pickup, dropoff }: CheckoutSummaryCardProps) {
  const { t } = useTranslation()
  const image = primaryImage(vehicle)
  const days = rentalDays(startDate, endDate)
  const quote = quoteForDays(vehicle.pricing, days)

  return (
    <aside className="rounded-none border border-brand-navy/10 bg-white p-5 shadow-sm">
      <div className="flex gap-3">
        <VehiclePhoto
          storagePath={image?.storage_path ?? null}
          alt={`${vehicle.make} ${vehicle.model}`}
          className="h-16 w-24 shrink-0 rounded-none"
        />
        <div>
          <p className="text-sm font-semibold text-brand-navy">
            {vehicle.make} {vehicle.model}
          </p>
          <p className="text-xs text-text-muted">{vehicle.model_year} · {vehicle.transmission}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 border-t border-brand-navy/10 pt-4 text-sm">
        <Row label={t('checkout.summaryCard.pickupDate')} value={startDate} />
        <Row label={t('checkout.summaryCard.dropoffDate')} value={endDate} />
        <Row label={t('checkout.summaryCard.duration')} value={`${days} ${t(days === 1 ? 'common.day' : 'common.days')}`} />
        <Row label={t('checkout.summaryCard.pickup')} value={pickup?.name ?? '—'} />
        <Row label={t('checkout.summaryCard.dropoff')} value={dropoff?.name ?? '—'} />
      </dl>

      <div className="mt-4 border-t border-brand-navy/10 pt-4">
        {quote ? (
          <>
            <p className="text-xl font-bold text-brand-navy">
              {quote.currency} {quote.totalPrice.toLocaleString()}
            </p>
            <p className="text-xs text-text-muted">
              {quote.currency} {quote.unitPrice.toLocaleString()} {TERM_LABELS[quote.term]} — {t('checkout.summaryCard.estimated')}
            </p>
          </>
        ) : (
          <p className="text-sm font-medium text-text-muted">{t('checkout.summaryCard.pricingUnavailable')}</p>
        )}
      </div>
    </aside>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium text-brand-navy">{value}</dd>
    </div>
  )
}
