import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useCheckoutContext } from '@/features/booking/checkout/useCheckoutContext'
import { CheckoutLoadGate } from '@/features/booking/checkout/CheckoutLoadGate'
import { CheckoutStepLayout } from '@/features/booking/checkout/CheckoutStepLayout'
import {
  createPaymentIntent,
  confirmStripePayment,
  CheckoutApiError,
  type ConfirmStripePaymentResult,
} from '@/features/booking/checkout/checkoutApi'
import { readBookingResult, saveConfirmationSnapshot, clearActiveBooking } from '@/features/booking/checkout/checkoutStorage'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { StateMessage } from '@/features/shared/StateMessage'
import { Button, Card, LoadingState, StatusBadge } from '@/features/shared/ui'
import { getStripe } from '@/lib/stripeClient'
import { effectiveDriverIdentity } from '@/types/domain'
import type { BookingCreationResult, CheckoutDraft, Location, VehicleWithDetails } from '@/types/domain'

const KNOWN_API_CODES = [
  'VALIDATION_ERROR',
  'VEHICLE_NOT_FOUND',
  'VEHICLE_UNAVAILABLE',
  'INVALID_LOCATION',
  'NO_PRICING',
  'PAYMENT_NOT_FOUND',
  'ALREADY_RESOLVED',
  'PAYMENT_NOT_COMPLETED',
  'SERVER_ERROR',
]

/**
 * Step 7 — Payment (checkout v2, 2026-09-20). Real Stripe integration:
 * this page never sees or stores a card number, CVV, or any other raw
 * payment detail — Stripe's own Payment Element (mounted below) collects
 * everything inside Stripe-hosted iframes, and offers cards, Google Pay,
 * Apple Pay etc. automatically depending on the browser/device (see
 * `automatic_payment_methods` in create-payment-intent/logic.ts). The
 * server independently re-verifies the PaymentIntent with Stripe before
 * ever marking the booking paid — see confirm-stripe-payment/logic.ts.
 */
export function PaymentPage() {
  const { t } = useTranslation()
  const { id: vehicleId, bookingId } = useParams<{ id: string; bookingId: string }>()
  const { loadState, vehicle, errorMessage, criteria, pickup, dropoff, draft } = useCheckoutContext(vehicleId)

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

  return (
    <CheckoutStepLayout
      stepIndex={3}
      title={t('checkout.payment.title')}
      vehicle={vehicle}
      startDate={criteria.startDate}
      endDate={criteria.endDate}
      pickup={pickup}
      dropoff={dropoff}
    >
      <PaymentStepBody
        vehicleId={vehicleId!}
        vehicle={vehicle}
        criteria={criteria}
        pickup={pickup}
        dropoff={dropoff}
        draft={draft}
        bookingResult={bookingResult}
      />
    </CheckoutStepLayout>
  )
}

interface PaymentStepBodyProps {
  vehicleId: string
  vehicle: VehicleWithDetails
  criteria: { startDate: string; endDate: string; pickupLocationId: string; dropoffLocationId: string }
  pickup: Location | null
  dropoff: Location | null
  draft: CheckoutDraft
  bookingResult: BookingCreationResult
}

function translatedApiError(t: (key: string) => string, err: CheckoutApiError): string {
  return KNOWN_API_CODES.includes(err.code) ? t(`errors.api.${err.code}`) : err.message
}

function PaymentStepBody({ vehicleId, vehicle, criteria, pickup, dropoff, draft, bookingResult }: PaymentStepBodyProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qs = criteriaToSearchParams(criteria).toString()

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [resolving, setResolving] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)

  function finalizeSuccess(result: ConfirmStripePaymentResult) {
    clearActiveBooking(vehicleId)
    const driverIdentity = effectiveDriverIdentity(draft.customer, draft.driver)
    saveConfirmationSnapshot({
      bookingReference: bookingResult.bookingReference,
      bookingId: result.bookingId,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      startDate: criteria.startDate,
      endDate: criteria.endDate,
      pickupLocationName: pickup?.name ?? '—',
      dropoffLocationName: dropoff?.name ?? '—',
      customerName: `${draft.customer.firstName} ${draft.customer.lastName}`.trim(),
      driverName: `${driverIdentity.firstName} ${driverIdentity.lastName}`.trim(),
      totalPrice: bookingResult.totalPrice,
      currency: bookingResult.currency,
      paymentStatus: result.paymentStatus,
      bookingStatus: result.bookingStatus,
    })
    navigate(`/checkout/${vehicleId}/confirmation/${result.bookingId}`)
  }

  useEffect(() => {
    let cancelled = false

    async function init() {
      setResolving(true)
      setInitError(null)
      // A redirect-based Stripe payment method (some banks/wallets) sends
      // the customer back to this exact URL with these query params —
      // when present, the PaymentIntent already has an outcome; finalize
      // it directly instead of creating a brand new one.
      const redirectPaymentIntentId = searchParams.get('payment_intent')
      try {
        if (redirectPaymentIntentId) {
          const result = await confirmStripePayment({
            paymentId: bookingResult.paymentId,
            paymentIntentId: redirectPaymentIntentId,
          })
          if (cancelled) return
          finalizeSuccess(result)
          return
        }
        const { clientSecret: secret } = await createPaymentIntent({ paymentId: bookingResult.paymentId })
        if (cancelled) return
        setClientSecret(secret)
      } catch (err) {
        if (cancelled) return
        setInitError(err instanceof CheckoutApiError ? translatedApiError(t, err) : t('checkout.payment.genericError'))
      } finally {
        if (!cancelled) setResolving(false)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (resolving) {
    return (
      <Card>
        <LoadingState label={t('checkout.payment.preparing')} />
      </Card>
    )
  }

  if (initError || !clientSecret) {
    return (
      <Card>
        <div className="space-y-4">
          <div className="rounded-none border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">
            {initError ?? t('checkout.payment.genericError')}
          </div>
          <Link to={`/checkout/${vehicleId}/summary?${qs}`} className="text-sm font-semibold text-text-muted underline hover:text-brand-navy">
            {t('checkout.payment.backToSummary')}
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <Elements stripe={getStripe()} options={{ clientSecret }}>
      <StripePaymentForm vehicleId={vehicleId} qs={qs} bookingResult={bookingResult} onSuccess={finalizeSuccess} />
    </Elements>
  )
}

interface StripePaymentFormProps {
  vehicleId: string
  qs: string
  bookingResult: BookingCreationResult
  onSuccess: (result: ConfirmStripePaymentResult) => void
}

function StripePaymentForm({ vehicleId, qs, bookingResult, onSuccess }: StripePaymentFormProps) {
  const { t } = useTranslation()
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!stripe || !elements || submitting) return // guards against a double-click / duplicate submit, and against submitting before Stripe.js is ready
    setSubmitting(true)
    setPayError(null)
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      })

      if (error) {
        setPayError(error.message ?? t('checkout.payment.declined'))
        return
      }
      if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        setPayError(t('checkout.payment.declined'))
        return
      }

      const result = await confirmStripePayment({ paymentId: bookingResult.paymentId, paymentIntentId: paymentIntent.id })
      onSuccess(result)
    } catch (err) {
      setPayError(err instanceof CheckoutApiError ? translatedApiError(t, err) : t('checkout.payment.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="bg-brand-lavender/40 px-4 py-3 text-sm text-brand-navy">
          <div className="flex items-center justify-between">
            <span>{t('checkout.payment.bookingReference')}</span>
            <span className="font-mono font-semibold">{bookingResult.bookingReference}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>{t('checkout.payment.amountDue')}</span>
            <span className="font-semibold">
              {bookingResult.currency} {bookingResult.totalPrice.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-brand-navy/10 pt-2">
            <span>{t('checkout.summary.paymentStatus')}</span>
            <StatusBadge status="pending" translationPrefix="admin.status" />
          </div>
        </div>

        <PaymentElement />

        {payError && <div className="rounded-none border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{payError}</div>}

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" loading={submitting} disabled={!stripe || !elements} fullWidthOnMobile>
            {submitting
              ? t('checkout.payment.processing')
              : `${t('checkout.payment.pay')} ${bookingResult.currency} ${bookingResult.totalPrice.toLocaleString()}`}
          </Button>
          <Link to={`/checkout/${vehicleId}/summary?${qs}`} className="text-sm font-semibold text-text-muted underline hover:text-brand-navy">
            {t('checkout.payment.backToSummary')}
          </Link>
        </div>

        <p className="text-center text-xs text-text-muted">{t('checkout.payment.securedByStripe')}</p>
      </form>
    </Card>
  )
}
