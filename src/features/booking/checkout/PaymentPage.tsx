import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCheckoutContext } from '@/features/booking/checkout/useCheckoutContext'
import { CheckoutLoadGate } from '@/features/booking/checkout/CheckoutLoadGate'
import { CheckoutStepLayout } from '@/features/booking/checkout/CheckoutStepLayout'
import { confirmPayment, CheckoutApiError } from '@/features/booking/checkout/checkoutApi'
import { readBookingResult, saveConfirmationSnapshot, clearActiveBooking } from '@/features/booking/checkout/checkoutStorage'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { StateMessage } from '@/features/shared/StateMessage'
import { Button, StatusBadge } from '@/features/shared/ui'

export function PaymentPage() {
  const { t } = useTranslation()
  const { id: vehicleId, bookingId } = useParams<{ id: string; bookingId: string }>()
  const navigate = useNavigate()
  const { loadState, vehicle, errorMessage, criteria, pickup, dropoff, draft } = useCheckoutContext(vehicleId)
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242')
  const [submitting, setSubmitting] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  // Set only on a declined test payment, per brief item 6 — a distinct
  // "Payment Failed" panel with Try Again / Back to Booking, instead of a
  // plain inline error string. The booking/payment are untouched either
  // way (confirm_payment is idempotent), so retry just resubmits the SAME
  // payment id.
  const [declined, setDeclined] = useState(false)

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

  const knownApiCodes = ['VALIDATION_ERROR', 'VEHICLE_NOT_FOUND', 'VEHICLE_UNAVAILABLE', 'INVALID_LOCATION', 'NO_PRICING', 'PAYMENT_NOT_FOUND', 'SERVER_ERROR']
  function translatedApiError(err: CheckoutApiError): string {
    return knownApiCodes.includes(err.code) ? t(`errors.api.${err.code}`) : err.message
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting || !vehicle) return // duplicate-submit guard; !vehicle can't happen given the earlier gate, but narrows the type for TS
    setSubmitting(true)
    setPayError(null)
    try {
      const result = await confirmPayment({ paymentId: bookingResult!.paymentId, cardNumber })

      if (result.paymentStatus === 'failed') {
        setDeclined(true)
        return
      }

      setDeclined(false)
      // Payment resolved — this booking is no longer "pending", so it
      // should stop being offered as a resumable summary and drop out of
      // the header reminder. See checkoutStorage.ts.
      if (vehicleId) clearActiveBooking(vehicleId)

      saveConfirmationSnapshot({
        bookingReference: bookingResult!.bookingReference,
        bookingId: result.bookingId,
        vehicleMake: vehicle.make,
        vehicleModel: vehicle.model,
        startDate: criteria!.startDate,
        endDate: criteria!.endDate,
        pickupLocationName: pickup?.name ?? '—',
        dropoffLocationName: dropoff?.name ?? '—',
        customerName: draft.customer.fullName,
        driverName: draft.driver.fullName,
        totalPrice: bookingResult!.totalPrice,
        currency: bookingResult!.currency,
        paymentStatus: result.paymentStatus,
        bookingStatus: result.bookingStatus,
      })
      navigate(`/checkout/${vehicleId}/confirmation/${result.bookingId}`)
    } catch (err) {
      setPayError(err instanceof CheckoutApiError ? translatedApiError(err) : t('checkout.payment.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (declined) {
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
        <div className="space-y-4 border border-error/25 bg-error-bg p-5">
          <div className="flex items-center gap-2">
            <StatusBadge status="failed" translationPrefix="admin.status" />
            <p className="text-sm font-semibold text-error">{t('checkout.payment.failedTitle')}</p>
          </div>
          <p className="text-sm text-text-muted">{t('checkout.payment.declined')}</p>

          <div className="border border-border bg-surface px-4 py-3 text-sm text-brand-navy">
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
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={() => setDeclined(false)} fullWidthOnMobile>
              {t('checkout.payment.tryAgain')}
            </Button>
            <Link to={`/checkout/${vehicleId}/summary?${qs}`} className="text-sm font-semibold text-text-muted underline hover:text-brand-navy">
              {t('checkout.payment.backToBooking')}
            </Link>
          </div>
        </div>
      </CheckoutStepLayout>
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
      <form onSubmit={handleSubmit} className="space-y-4 border border-border bg-surface p-5">
        <div className="flex items-center justify-between bg-warning-bg px-3 py-2 text-xs font-semibold text-warning">
          <span>{t('checkout.payment.testBadge')}</span>
        </div>

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

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t('checkout.payment.cardNumber')}
          </span>
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
          />
          <span className="mt-1 block text-xs text-text-muted">{t('checkout.payment.cardNumberHelp')}</span>
        </label>

        {payError && <div className="border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{payError}</div>}

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" loading={submitting} fullWidthOnMobile>
            {submitting
              ? t('checkout.payment.processing')
              : `${t('checkout.payment.pay')} ${bookingResult.currency} ${bookingResult.totalPrice.toLocaleString()}`}
          </Button>
          <Link to={`/checkout/${vehicleId}/summary?${qs}`} className="text-sm font-semibold text-text-muted underline hover:text-brand-navy">
            {t('checkout.payment.backToSummary')}
          </Link>
        </div>
      </form>
    </CheckoutStepLayout>
  )
}
