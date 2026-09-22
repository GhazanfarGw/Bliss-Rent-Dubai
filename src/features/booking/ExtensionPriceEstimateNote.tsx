import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CurrencySymbol } from '@/features/shared/ui/CurrencySymbol'
import type { ExtensionPriceEstimate } from '@/features/booking/useExtensionPriceEstimate'

function formatMoney(currency: string, amount: number): ReactNode {
  return (
    <>
      <CurrencySymbol currency={currency} /> {amount.toLocaleString()}
    </>
  )
}

/**
 * The "you paid X, this adds Y, new total Z" preview — shared by
 * ExtendRentalSection.tsx (standalone Manage Booking page) and
 * ManageBookingVerifyPanel.tsx (homepage Navigator) so both extend-rental
 * entry points show the exact same estimate in the exact same words. Pure
 * presentation: all the numbers come from useExtensionPriceEstimate.ts.
 */
export function ExtensionPriceEstimateNote({
  estimate,
  paidAmount,
  paidCurrency,
}: {
  estimate: ExtensionPriceEstimate
  /** The booking's already-paid total — shown regardless of whether the live estimate resolved, since it's already known data (BookingLookupResult), not part of the computed estimate. */
  paidAmount: number
  paidCurrency: string
}) {
  const { t } = useTranslation()

  if (estimate.status === 'loading') {
    return <p className="text-xs text-text-muted">{t('extendRental.estimate.loading')}</p>
  }

  if (estimate.status !== 'ready' || estimate.addedAmount == null || estimate.newTotal == null || !estimate.currency) {
    return null
  }

  return (
    <div className="space-y-1 rounded-lg border border-brand-gold/25 bg-brand-gold/5 px-4 py-3 text-xs">
      <Line label={t('extendRental.estimate.paidLabel')} value={formatMoney(paidCurrency, paidAmount)} />
      <Line label={t('extendRental.estimate.addedLabel')} value={formatMoney(estimate.currency, estimate.addedAmount)} />
      {estimate.isLate && estimate.penaltyAmount ? (
        <Line label={t('extendRental.estimate.lateFeeLabel')} value={formatMoney(estimate.currency, estimate.penaltyAmount)} />
      ) : null}
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-brand-gold/25 pt-1.5 font-bold text-brand-navy">
        <span>{t('extendRental.estimate.newTotalLabel')}</span>
        <span>{formatMoney(estimate.currency, estimate.newTotal)}</span>
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-text-muted">
      <span>{label}</span>
      <span className="font-medium text-brand-navy">{value}</span>
    </div>
  )
}
