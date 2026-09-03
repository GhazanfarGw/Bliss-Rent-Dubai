import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCheckoutContext } from '@/features/booking/checkout/useCheckoutContext'
import { CheckoutLoadGate } from '@/features/booking/checkout/CheckoutLoadGate'
import { CheckoutStepLayout } from '@/features/booking/checkout/CheckoutStepLayout'
import { createBooking, CheckoutApiError } from '@/features/booking/checkout/checkoutApi'
import { saveBookingResult, saveActiveBooking, readActiveBooking, type ActiveBookingPointer } from '@/features/booking/checkout/checkoutStorage'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { rentalDays } from '@/lib/dateRange'
import { quoteForDays, TERM_LABELS } from '@/lib/pricing'
import { Button, StatusBadge } from '@/features/shared/ui'

export function BookingSummaryPage() {
  const { t } = useTranslation()
  const { id: vehicleId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { loadState, vehicle, errorMessage, criteria, pickup, dropoff, draft } = useCheckoutContext(vehicleId)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<{ message: string; unavailable: boolean } | null>(null)
  // Set only by "This isn't right — start a new booking" below, so a
  // customer who deliberately wants a fresh attempt for THIS vehicle can
  // bypass the resume panel without waiting for dates/locations to change.
  const [ignoreResumable, setIgnoreResumable] = useState(false)

  if (loadState !== 'ready' || !vehicle || !criteria) {
    return <CheckoutLoadGate loadState={loadState} vehicleId={vehicleId} errorMessage={errorMessage} />
  }

  const qs = criteriaToSearchParams(criteria).toString()
  const days = rentalDays(criteria.startDate, criteria.endDate)
  const estimatedQuote = quoteForDays(vehicle.pricing, days)

  // THE FIX: before ever calling create-booking, check whether this exact
  // vehicle + these exact dates/locations already produced a pending
  // booking earlier in this same checkout session (e.g. the customer went
  // Payment → Back to Summary). If so, this is a RESUME, not a new
  // booking attempt — resuming must never re-run create-booking, because
  // the bookings_no_overlap exclusion constraint (correctly) rejects a
  // second insert that overlaps the customer's own still-pending first
  // one. See checkoutStorage.ts for the full root-cause writeup.
  const resumable: ActiveBookingPointer | null = ignoreResumable ? null : readActiveBooking(vehicleId!, criteria)

  // The server (create-booking Edge Function) is the sole source of
  // truth for the error code — we translate it here by code, falling
  // back to its raw message only for an unrecognized/legacy code.
  function translatedApiError(code: string, fallbackMessage: string): string {
    const known = ['VALIDATION_ERROR', 'VEHICLE_NOT_FOUND', 'VEHICLE_UNAVAILABLE', 'INVALID_LOCATION', 'NO_PRICING', 'PAYMENT_NOT_FOUND', 'SERVER_ERROR']
    return known.includes(code) ? t(`errors.api.${code}`) : fallbackMessage
  }

  function goToPayment(bookingId: string) {
    navigate(`/checkout/${vehicleId}/payment/${bookingId}?${qs}`)
  }

  async function handleConfirm() {
    if (submitting) return // guards against a double-click / duplicate submit
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await createBooking({
        vehicleId: vehicleId!,
        startDate: criteria!.startDate,
        endDate: criteria!.endDate,
        pickupLocationId: criteria!.pickupLocationId,
        dropoffLocationId: criteria!.dropoffLocationId,
        customer: draft.customer,
        driver: draft.driver,
      })
      saveBookingResult(result)
      saveActiveBooking({
        vehicleId: vehicleId!,
        vehicleMake: vehicle!.make,
        vehicleModel: vehicle!.model,
        startDate: criteria!.startDate,
        endDate: criteria!.endDate,
        pickupLocationId: criteria!.pickupLocationId,
        dropoffLocationId: criteria!.dropoffLocationId,
        pickupLocationName: pickup?.name ?? '—',
        dropoffLocationName: dropoff?.name ?? '—',
        bookingId: result.bookingId,
        bookingReference: result.bookingReference,
        paymentId: result.paymentId,
        totalPrice: result.totalPrice,
        currency: result.currency,
      })
      goToPayment(result.bookingId)
    } catch (err) {
      if (err instanceof CheckoutApiError) {
        setSubmitError({ message: translatedApiError(err.code, err.message), unavailable: err.code === 'VEHICLE_UNAVAILABLE' })
      } else {
        setSubmitError({ message: t('checkout.summary.genericError'), unavailable: false })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (resumable) {
    return (
      <CheckoutStepLayout
        stepIndex={2}
        title={t('checkout.summary.title')}
        vehicle={vehicle}
        startDate={criteria.startDate}
        endDate={criteria.endDate}
        pickup={pickup}
        dropoff={dropoff}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-brand-champagne/40 bg-brand-champagne/10 p-5">
            <p className="text-sm font-semibold text-brand-navy">{t('checkout.summary.resumeTitle')}</p>
            <p className="mt-1 text-sm text-text-muted">{t('checkout.summary.resumeBody')}</p>
          </div>

          <Section title={t('checkout.summary.vehicleSection')}>
            <Row label={t('checkout.summary.vehicle')} value={`${vehicle.make} ${vehicle.model} (${vehicle.model_year})`} />
            <Row label={t('checkout.summary.rentalDates')} value={`${criteria.startDate} → ${criteria.endDate}`} />
            <Row label={t('checkout.payment.bookingReference')} value={resumable.bookingReference} />
            <Row label={t('checkout.payment.amountDue')} value={`${resumable.currency} ${resumable.totalPrice.toLocaleString()}`} />
            <Row label={t('checkout.summary.paymentStatus')} value={<StatusBadge status="pending" translationPrefix="admin.status" />} />
          </Section>

          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={() => goToPayment(resumable.bookingId)} fullWidthOnMobile>
              {t('checkout.summary.resumeContinue')}
            </Button>
            <Button variant="ghost" onClick={() => setIgnoreResumable(true)}>
              {t('checkout.summary.resumeStartOver')}
            </Button>
          </div>
        </div>
      </CheckoutStepLayout>
    )
  }

  return (
    <CheckoutStepLayout
      stepIndex={2}
      title={t('checkout.summary.title')}
      vehicle={vehicle}
      startDate={criteria.startDate}
      endDate={criteria.endDate}
      pickup={pickup}
      dropoff={dropoff}
    >
      <div className="space-y-4">
        <Section title={t('checkout.summary.vehicleSection')}>
          <Row label={t('checkout.summary.vehicle')} value={`${vehicle.make} ${vehicle.model} (${vehicle.model_year})`} />
          <Row label={t('checkout.summary.rentalDates')} value={`${criteria.startDate} → ${criteria.endDate}`} />
          <Row label={t('checkout.summary.duration')} value={`${days} ${t(days === 1 ? 'common.day' : 'common.days')}`} />
          <Row label={t('checkout.summary.pickup')} value={pickup?.name ?? '—'} />
          <Row label={t('checkout.summary.dropoff')} value={dropoff?.name ?? '—'} />
        </Section>

        <Section title={t('checkout.summary.customerSection')}>
          <Row label={t('checkout.summary.name')} value={draft.customer.fullName} />
          <Row label={t('checkout.summary.email')} value={draft.customer.email} />
          <Row label={t('checkout.summary.phone')} value={draft.customer.phone || '—'} />
        </Section>

        <Section title={t('checkout.summary.driverSection')}>
          <Row label={t('checkout.summary.name')} value={draft.driver.fullName} />
          <Row label={t('checkout.summary.dateOfBirth')} value={draft.driver.dateOfBirth} />
          <Row label={t('checkout.summary.licenseNumber')} value={draft.driver.licenseNumber} />
          <Row label={t('checkout.summary.licenseCountry')} value={draft.driver.licenseCountry} />
          <Row label={t('checkout.summary.licenseExpiry')} value={draft.driver.licenseExpiry} />
        </Section>

        <Section title={t('checkout.summary.pricingSection')}>
          {estimatedQuote ? (
            <>
              <Row
                label={`${t('checkout.summary.rate')} (${TERM_LABELS[estimatedQuote.term]})`}
                value={`${estimatedQuote.currency} ${estimatedQuote.unitPrice.toLocaleString()}`}
              />
              <Row label={t('checkout.summary.totalEstimated')} value={`${estimatedQuote.currency} ${estimatedQuote.totalPrice.toLocaleString()}`} />
              <p className="pt-1 text-xs text-text-muted">{t('checkout.summary.estimateNote')}</p>
            </>
          ) : (
            <p className="text-sm text-error">{t('checkout.summary.pricingUnavailable')}</p>
          )}
          <Row label={t('checkout.summary.paymentStatus')} value={t('checkout.summary.notYetPaid')} />
        </Section>

        {submitError && (
          <div className="rounded-lg border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">
            <p className="font-medium">{submitError.message}</p>
            {submitError.unavailable && (
              <Link to="/search" className="mt-2 inline-block font-semibold underline">
                {t('checkout.summary.backToAnotherVehicle')}
              </Link>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !estimatedQuote}
            className="rounded-lg bg-brand-gold px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-gold-light disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
          >
            {submitting ? t('checkout.summary.confirming') : t('checkout.summary.confirm')}
          </button>
          <Link
            to={`/checkout/${vehicleId}/driver?${qs}`}
            className="text-sm font-semibold text-text-muted underline hover:text-brand-navy"
          >
            {t('common.back')}
          </Link>
        </div>
      </div>
    </CheckoutStepLayout>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
      <h2 className="text-sm font-semibold text-brand-navy">{title}</h2>
      <dl className="mt-3 space-y-2 text-sm">{children}</dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium text-brand-navy">{value}</dd>
    </div>
  )
}
