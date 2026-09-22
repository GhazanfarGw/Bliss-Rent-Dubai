import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Car, ContactRound, IdCard, ReceiptText, type LucideIcon } from 'lucide-react'
import { useCheckoutContext } from '@/features/booking/checkout/useCheckoutContext'
import { CheckoutLoadGate } from '@/features/booking/checkout/CheckoutLoadGate'
import { ACTION_BUTTON_CLASS, CheckoutActions } from '@/features/booking/checkout/CheckoutActions'
import { CheckoutStepLayout } from '@/features/booking/checkout/CheckoutStepLayout'
import { createBooking, CheckoutApiError } from '@/features/booking/checkout/checkoutApi'
import { saveBookingResult, saveActiveBooking, readActiveBooking, type ActiveBookingPointer } from '@/features/booking/checkout/checkoutStorage'
import { validateCustomerDraft, validateDriverDraft } from '@/features/booking/checkout/validation'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { rentalDays } from '@/lib/dateRange'
import { quoteForDays, TERM_LABELS } from '@/lib/pricing'
import { Button, StatusBadge } from '@/features/shared/ui'
import { CurrencySymbol } from '@/features/shared/ui/CurrencySymbol'
import { effectiveDriverIdentity } from '@/types/domain'

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
  // Bring a submission problem into view even when Confirm is in the mobile bar.
  const alertRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (submitError) alertRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [submitError])

  if (loadState !== 'ready' || !vehicle || !criteria) {
    return <CheckoutLoadGate loadState={loadState} vehicleId={vehicleId} errorMessage={errorMessage} />
  }

  const qs = criteriaToSearchParams(criteria).toString()
  const days = rentalDays(criteria.startDate, criteria.endDate)
  const estimatedQuote = quoteForDays(vehicle.pricing, days)
  const driverIdentity = effectiveDriverIdentity(draft.customer, draft.driver)

  // Defensive re-check (2026-09-20): the Customer/Driver steps already
  // validate their own fields before letting the customer navigate
  // forward, but this Review page has no editable fields of its own to
  // show a per-field error on — so if it's ever reached with incomplete
  // data (e.g. an old bookmark, a stale sessionStorage draft from before
  // a schema change, or manual back/forward navigation), calling
  // create-booking would just come back with a generic, confusing
  // "check the highlighted fields" error and nothing to actually
  // highlight. Catching it here instead sends the customer straight back
  // to whichever step is actually incomplete, with a clear reason, and
  // never even attempts the doomed API call.
  const customerErrors = validateCustomerDraft(draft.customer)
  const driverErrors = validateDriverDraft(draft.customer, draft.driver, criteria.endDate)
  const incompleteStep: 'customer' | 'driver' | null =
    Object.keys(customerErrors).length > 0 ? 'customer' : Object.keys(driverErrors).length > 0 ? 'driver' : null

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
    if (submitting || incompleteStep) return // guards against a double-click / duplicate submit, and against submitting known-incomplete data
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await createBooking({
        vehicleId: vehicleId!,
        startDate: criteria!.startDate,
        endDate: criteria!.endDate,
        pickupLocationId: criteria!.pickupLocationId,
        dropoffLocationId: criteria!.dropoffLocationId,
        customer: {
          firstName: draft.customer.firstName,
          lastName: draft.customer.lastName,
          email: draft.customer.email,
          phone: draft.customer.phone,
        },
        driver: {
          firstName: driverIdentity.firstName,
          lastName: driverIdentity.lastName,
          phone: driverIdentity.phone,
          licenseNumber: draft.driver.licenseNumber,
          licenseCountry: draft.driver.licenseCountry,
          licenseExpiry: draft.driver.licenseExpiry,
        },
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

  // One page for both cases: the full summary is always shown. When a pending
  // booking already exists for this exact trip (`resumable`), a banner on top
  // says so and offers "This isn't right — start a new booking"; the pricing
  // panel then shows that booking's reference and amount due, and the button
  // continues to payment instead of creating a booking again.
  return (
    <CheckoutStepLayout
      stepIndex={2}
      title={t('checkout.summary.title')}
      vehicle={vehicle}
      startDate={criteria.startDate}
      endDate={criteria.endDate}
      pickup={pickup}
      dropoff={dropoff}
      // Steps 1–3 keep the trip card to the car and its specs; the dates and
      // both places are in the Vehicle section below.
      showTripInCard={false}
      total={
        resumable
          ? { label: t('checkout.payment.amountDue'), amount: resumable.totalPrice, currency: resumable.currency }
          : undefined
      }
    >
      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        {resumable && (
          <div className="border-s-4 border-brand-gold bg-brand-gold/5 p-4 xl:col-span-2">
            <p className="font-hero-serif text-xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-2xl">
              {t('checkout.summary.resumeTitle')}
            </p>
            <p className="mt-1.5 max-w-2xl text-sm leading-5 text-text-muted">{t('checkout.summary.resumeBody')}</p>
            <Button variant="ghost" size="compact" className="-ms-4 mt-2" onClick={() => setIgnoreResumable(true)}>
              {t('checkout.summary.resumeStartOver')}
            </Button>
          </div>
        )}

        <Section title={t('checkout.summary.vehicleSection')} icon={Car} columns className="xl:order-1">
          <Row label={t('checkout.summary.vehicle')} value={`${vehicle.make} ${vehicle.model} (${vehicle.model_year})`} />
          <Row label={t('checkout.summary.rentalDates')} value={`${criteria.startDate} → ${criteria.endDate}`} />
          <Row label={t('checkout.summary.duration')} value={`${days} ${t(days === 1 ? 'common.day' : 'common.days')}`} />
          <Row label={t('checkout.summary.pickup')} value={pickup?.name ?? '—'} />
          <Row label={t('checkout.summary.dropoff')} value={dropoff?.name ?? '—'} />
        </Section>

        <section className="min-w-0 border border-brand-navy/10 bg-white xl:order-3 xl:col-span-2">
          <div className="grid sm:grid-cols-2">
            <Block title={t('checkout.summary.customerSection')} icon={ContactRound}>
              <Row label={t('checkout.summary.name')} value={`${draft.customer.firstName} ${draft.customer.lastName}`.trim() || '—'} />
              <Row label={t('checkout.summary.email')} value={draft.customer.email || '—'} />
              <Row label={t('checkout.summary.phone')} value={draft.customer.phone || '—'} />
            </Block>

            <Block
              title={t('checkout.summary.driverSection')}
              icon={IdCard}
              className="border-t border-brand-navy/10 sm:border-s sm:border-t-0"
            >
              <Row label={t('checkout.summary.name')} value={`${driverIdentity.firstName} ${driverIdentity.lastName}`.trim() || '—'} />
              <Row label={t('checkout.summary.phone')} value={driverIdentity.phone || '—'} />
              <Row label={t('checkout.summary.licenseNumber')} value={draft.driver.licenseNumber || '—'} />
              <Row label={t('checkout.summary.licenseCountry')} value={draft.driver.licenseCountry || '—'} />
              <Row label={t('checkout.summary.licenseExpiry')} value={draft.driver.licenseExpiry || '—'} />
            </Block>
          </div>
        </section>

        {/* Keep pricing beside the trip on wide screens, and after the
            personal details on phones so the full review reads naturally. */}
        <section className="min-w-0 border border-t-4 border-brand-gold bg-white p-4 xl:order-2">
          {incompleteStep && (
            <div ref={alertRef} role="alert" className="mb-4 border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">
              <p className="font-medium">
                {incompleteStep === 'customer' ? t('checkout.summary.incompleteCustomer') : t('checkout.summary.incompleteDriver')}
              </p>
              <Link
                to={`/checkout/${vehicleId}/${incompleteStep}?${qs}`}
                className="mt-2 inline-block font-semibold underline"
              >
                {incompleteStep === 'customer' ? t('checkout.customer.title') : t('checkout.driver.title')}
              </Link>
            </div>
          )}

          {submitError && (
            <div ref={alertRef} role="alert" className="mb-4 border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">
              <p className="font-medium">{submitError.message}</p>
              {submitError.unavailable && (
                <Link to="/search" className="mt-2 inline-block font-semibold underline">
                  {t('checkout.summary.backToAnotherVehicle')}
                </Link>
              )}
            </div>
          )}

          <SectionTitle title={t('checkout.summary.pricingSection')} icon={ReceiptText} />
          {resumable ? (
            <dl className="mt-2.5 space-y-2 text-sm">
              <Row label={t('checkout.payment.bookingReference')} value={resumable.bookingReference} />
              <Row
                label={t('checkout.payment.amountDue')}
                value={<><CurrencySymbol currency={resumable.currency} /> {resumable.totalPrice.toLocaleString()}</>}
                strong
              />
              <Row label={t('checkout.summary.paymentStatus')} value={<StatusBadge status="pending" translationPrefix="admin.status" />} />
            </dl>
          ) : (
            <>
              <dl className="mt-2.5 space-y-2 text-sm">
                {estimatedQuote ? (
                  <>
                    <Row
                      label={`${t('checkout.summary.rate')} (${TERM_LABELS[estimatedQuote.term]})`}
                      value={<><CurrencySymbol currency={estimatedQuote.currency} /> {estimatedQuote.unitPrice.toLocaleString()}</>}
                    />
                    <Row
                      label={t('checkout.summary.totalEstimated')}
                      value={<><CurrencySymbol currency={estimatedQuote.currency} /> {estimatedQuote.totalPrice.toLocaleString()}</>}
                      strong
                    />
                  </>
                ) : (
                  <p className="text-sm text-error">{t('checkout.summary.pricingUnavailable')}</p>
                )}
                <Row label={t('checkout.summary.paymentStatus')} value={t('checkout.summary.notYetPaid')} />
              </dl>
              {estimatedQuote && <p className="mt-2 text-xs leading-4 text-text-muted">{t('checkout.summary.estimateNote')}</p>}
            </>
          )}
        </section>
      </div>

      <CheckoutActions backTo={`/checkout/${vehicleId}/driver?${qs}`}>
        {resumable ? (
          <Button size="compact" className={ACTION_BUTTON_CLASS} onClick={() => goToPayment(resumable.bookingId)}>
            {t('checkout.summary.resumeContinue')}
          </Button>
        ) : (
          <Button
            type="button"
            size="compact"
            className={ACTION_BUTTON_CLASS}
            onClick={() => void handleConfirm()}
            loading={submitting}
            disabled={!estimatedQuote || !!incompleteStep}
          >
            {submitting ? t('checkout.summary.confirming') : t('checkout.summary.confirm')}
          </Button>
        )}
      </CheckoutActions>
    </CheckoutStepLayout>
  )
}

/** A titled group of rows, tight enough that a review page needs little scrolling. */
function Block({
  title,
  icon,
  className = '',
  columns = false,
  children,
}: {
  title: string
  icon: LucideIcon
  className?: string
  /** Pair trip rows while the panel is full width; use single rows beside pricing. */
  columns?: boolean
  children: ReactNode
}) {
  return (
    <div className={`min-w-0 p-4 ${className}`}>
      <SectionTitle title={title} icon={icon} />
      <dl className={columns ? 'mt-2.5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-1' : 'mt-2.5 space-y-2 text-sm'}>{children}</dl>
    </div>
  )
}

function Section({
  title,
  icon,
  emphasis = false,
  columns = false,
  className = '',
  children,
}: {
  title: string
  icon: LucideIcon
  emphasis?: boolean
  columns?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`min-w-0 border bg-white ${emphasis ? 'border-brand-gold border-t-4' : 'border-brand-navy/10'} ${className}`}>
      <Block title={title} icon={icon} columns={columns}>
        {children}
      </Block>
    </section>
  )
}

function SectionTitle({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-2 border-b border-brand-navy/10 pb-2">
      <span className="grid h-6 w-6 shrink-0 place-items-center bg-brand-navy text-white">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-brand-navy">{title}</h2>
    </div>
  )
}

function Row({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-2">
      <dt className="leading-5 text-text-muted">{label}</dt>
      <dd className={`min-w-0 break-words text-end leading-5 text-brand-navy ${strong ? 'text-base font-bold sm:text-lg' : 'font-medium'}`}>{value}</dd>
    </div>
  )
}
