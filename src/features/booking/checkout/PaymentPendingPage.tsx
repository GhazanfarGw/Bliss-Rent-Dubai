import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, MessageCircle } from 'lucide-react'
import { useCheckoutContext } from '@/features/booking/checkout/useCheckoutContext'
import { CheckoutLoadGate } from '@/features/booking/checkout/CheckoutLoadGate'
import { ACTION_BUTTON_CLASS, CheckoutActions } from '@/features/booking/checkout/CheckoutActions'
import { CheckoutStepLayout } from '@/features/booking/checkout/CheckoutStepLayout'
import { readBookingResult } from '@/features/booking/checkout/checkoutStorage'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { whatsappUrlForVehicle } from '@/features/booking/contactLinks'
import { StateMessage } from '@/features/shared/StateMessage'
import { Card, buttonClass } from '@/features/shared/ui'
import { CurrencySymbol } from '@/features/shared/ui/CurrencySymbol'
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
      total={{
        label: t('checkout.payment.amountDue'),
        amount: bookingResult.totalPrice,
        currency: bookingResult.currency,
      }}
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
    <>
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-2 border-b border-brand-gold/15 bg-white">
        <div className="min-w-0 p-4 text-brand-navy sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">
            {t('checkout.payment.bookingReference')}
          </p>
          <p className="mt-1 break-all font-mono text-sm font-semibold sm:text-base">{bookingReference}</p>
        </div>
        <div className="min-w-0 border-s border-brand-gold/15 p-4 text-end text-brand-navy sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">
            {t('checkout.payment.amountDue')}
          </p>
          <p className="mt-1 font-hero-serif text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
            <CurrencySymbol currency={currency} /> {totalPrice.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 border-s-2 border-brand-gold bg-brand-gold/5 p-3 sm:p-4">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold-dark" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold text-brand-navy">{t('checkout.paymentPending.heading')}</p>
            <p className="mt-1 text-sm leading-5 text-text-muted">{t('checkout.paymentPending.body')}</p>
          </div>
        </div>

      </div>
    </Card>

    <CheckoutActions backTo={`/checkout/${vehicleId}/summary?${qs}`} backLabel={t('checkout.payment.backToSummary')}>
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className={`${buttonClass({ variant: 'success', size: 'compact' })} ${ACTION_BUTTON_CLASS}`}
        >
          <MessageCircle className="hidden h-5 w-5 shrink-0 sm:block" aria-hidden="true" />
          {t('checkout.paymentPending.whatsappCta')}
        </a>
    </CheckoutActions>
    </>
  )
}
