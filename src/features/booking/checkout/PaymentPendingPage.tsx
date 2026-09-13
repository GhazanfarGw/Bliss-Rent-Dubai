import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import { useCheckoutContext } from '@/features/booking/checkout/useCheckoutContext'
import { CheckoutLoadGate } from '@/features/booking/checkout/CheckoutLoadGate'
import { CheckoutStepLayout } from '@/features/booking/checkout/CheckoutStepLayout'
import { readBookingResult } from '@/features/booking/checkout/checkoutStorage'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { whatsappUrlForVehicle } from '@/features/booking/contactLinks'
import { StateMessage } from '@/features/shared/StateMessage'
import { Card, buttonClass } from '@/features/shared/ui'
import type { VehicleWithDetails } from '@/types/domain'

/**
 * TEMPORARY (2026-09-11): stands in for the real Payment step while
 * live Stripe checkout is paused for testing/safety. This page does
 * NOT touch Stripe, create-payment-intent / confirm-stripe-payment,
 * the webhook, pricing, availability, or booking creation — the
 * booking made by BookingSummaryPage.handleConfirm() still exists in
 * the database exactly as before, as `pending_payment`. This page
 * only replaces what the customer *sees* at
 * `/checkout/:id/payment/:bookingId`, wired in App.tsx.
 *
 * Revert: in App.tsx, restore `import { PaymentPage } from
 * '@/features/booking/checkout/PaymentPage'` and change that route's
 * element back to `<PaymentPage />`. Nothing else needs to change —
 * this file, its i18n keys, and the real PaymentPage.tsx can all stay
 * exactly as they are.
 */
export function PaymentPendingPage() {
  const { t } = useTranslation()
  const { id: vehicleId, bookingId } = useParams<{ id: string; bookingId: string }>()
  const { loadState, vehicle, errorMessage, criteria, pickup, dropoff } = useCheckoutContext(vehicleId)

  if (loadState !== 'ready' || !vehicle || !criteria) {
    return <CheckoutLoadGate loadState={loadState} vehicleId={vehicleId} errorMessage={errorMessage} />
  }

  const bookingResult = bookingId ? readBookingResult(bookingId) : null

  if (!bookingResult) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <StateMessage
          tone="error"
          title={t('checkout.payment.notFoundTitle')}
          body={t('checkout.payment.notFoundBody')}
          action={
            <Link to={`/vehicles/${vehicleId}`} className="text-sm font-semibold text-brand-navy underline">
              {t('checkout.backToVehicle')}
            </Link>
          }
        />
      </div>
    )
  }

  const qs = criteriaToSearchParams(criteria).toString()

  return (
    <CheckoutStepLayout
      stepIndex={3}
      title={t('checkout.paymentPending.title')}
      vehicle={vehicle}
      startDate={criteria.startDate}
      endDate={criteria.endDate}
      pickup={pickup}
      dropoff={dropoff}
    >
      <PaymentPendingBody
        vehicle={vehicle}
        vehicleId={vehicleId!}
        qs={qs}
        bookingReference={bookingResult.bookingReference}
        currency={bookingResult.currency}
        totalPrice={bookingResult.totalPrice}
      />
    </CheckoutStepLayout>
  )
}

interface PaymentPendingBodyProps {
  vehicle: VehicleWithDetails
  vehicleId: string
  qs: string
  bookingReference: string
  currency: string
  totalPrice: number
}

function PaymentPendingBody({ vehicle, vehicleId, qs, bookingReference, currency, totalPrice }: PaymentPendingBodyProps) {
  const { t } = useTranslation()
  const waUrl = whatsappUrlForVehicle(`${vehicle.make} ${vehicle.model} — booking ${bookingReference}`)

  return (
    <Card>
      <div className="space-y-5">
        <div className="bg-brand-lavender/40 px-4 py-3 text-sm text-brand-navy">
          <div className="flex items-center justify-between">
            <span>{t('checkout.payment.bookingReference')}</span>
            <span className="font-mono font-semibold">{bookingReference}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>{t('checkout.payment.amountDue')}</span>
            <span className="font-semibold">
              {currency} {totalPrice.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="rounded-none border border-brand-gold/30 bg-brand-gold/5 px-4 py-4 text-sm">
          <p className="font-semibold text-brand-navy">{t('checkout.paymentPending.heading')}</p>
          <p className="mt-1 text-text-muted">{t('checkout.paymentPending.body')}</p>
        </div>

        <a href={waUrl} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'success', fullWidthOnMobile: true })}>
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {t('checkout.paymentPending.whatsappCta')}
        </a>

        <Link
          to={`/checkout/${vehicleId}/summary?${qs}`}
          className="block text-center text-sm font-semibold text-text-muted underline hover:text-brand-navy"
        >
          {t('checkout.payment.backToSummary')}
        </Link>
      </div>
    </Card>
  )
}
