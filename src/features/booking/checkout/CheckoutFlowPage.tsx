import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Car, Check, ContactRound, IdCard, Pencil, ReceiptText, type LucideIcon } from 'lucide-react'
import { useCheckoutContext } from '@/features/booking/checkout/useCheckoutContext'
import { CheckoutLoadGate } from '@/features/booking/checkout/CheckoutLoadGate'
import { ACTION_BUTTON_CLASS, CheckoutActions, revealFirstError } from '@/features/booking/checkout/CheckoutActions'
import { CheckoutStepLayout } from '@/features/booking/checkout/CheckoutStepLayout'
import {
  validateCustomerDraft,
  validateDriverDraft,
  type CustomerFieldErrors,
  type DriverFieldErrors,
} from '@/features/booking/checkout/validation'
import { createBooking, CheckoutApiError } from '@/features/booking/checkout/checkoutApi'
import { saveBookingResult, saveActiveBooking, readActiveBooking, type ActiveBookingPointer } from '@/features/booking/checkout/checkoutStorage'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { rentalDays } from '@/lib/dateRange'
import { quoteForDays, TERM_LABELS } from '@/lib/pricing'
import { Button, Card, DateField, StatusBadge, TextField } from '@/features/shared/ui'
import { CurrencySymbol } from '@/features/shared/ui/CurrencySymbol'
import { effectiveDriverIdentity, type CustomerDraft, type DriverDraft } from '@/types/domain'

type CheckoutStep = 'customer' | 'driver' | 'summary'

const STEP_INDEX: Record<CheckoutStep, number> = { customer: 0, driver: 1, summary: 2 }

/**
 * One continuous checkout — Your Details → Driver Details → Review — all on
 * the same route/component (`/checkout/:id/:step`), replacing what used to
 * be three separate pages (CustomerDetailsPage/DriverDetailsPage/
 * BookingSummaryPage, each its own route). Because all three URLs now match
 * the same <Route element>, moving between them re-renders this component
 * in place rather than unmounting/remounting it, so the transition feels
 * like advancing within one flow instead of loading a new page.
 *
 * A finished step collapses into a compact, read-only recap with an "Edit"
 * link back to it (`CompletedStepCard` below, and the Customer/Driver
 * blocks on the Review step) — the customer never has to wonder whether
 * what they typed earlier survived, and never has to retype it.
 *
 * Nothing about validation, draft persistence (useCheckoutContext/
 * useCheckoutDraft), booking creation, the resume-vs-recreate guard, or the
 * handoff to Payment changed — this is the same logic the three pages used,
 * just recomposed into one file and one route.
 */
export function CheckoutFlowPage() {
  const { t } = useTranslation()
  const { id: vehicleId, step: stepParam } = useParams<{ id: string; step: string }>()
  const navigate = useNavigate()
  const { loadState, vehicle, errorMessage, criteria, pickup, dropoff, draft, updateCustomer, updateDriver } =
    useCheckoutContext(vehicleId)

  const [customerFieldErrors, setCustomerFieldErrors] = useState<CustomerFieldErrors>({})
  const [customerTouched, setCustomerTouched] = useState(false)
  const [driverFieldErrors, setDriverFieldErrors] = useState<DriverFieldErrors>({})
  const [driverTouched, setDriverTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<{ message: string; unavailable: boolean } | null>(null)
  // Set only by "This isn't right — start a new booking", so a customer who
  // deliberately wants a fresh attempt for THIS vehicle can bypass the
  // resume panel without waiting for dates/locations to change.
  const [ignoreResumable, setIgnoreResumable] = useState(false)
  const alertRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (submitError) alertRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [submitError])

  if (loadState !== 'ready' || !vehicle || !criteria) {
    return <CheckoutLoadGate loadState={loadState} vehicleId={vehicleId} errorMessage={errorMessage} />
  }

  const step: CheckoutStep | null =
    stepParam === 'customer' || stepParam === 'driver' || stepParam === 'summary' ? stepParam : null
  const qs = criteriaToSearchParams(criteria).toString()

  if (!step) {
    return <Navigate to={`/checkout/${vehicleId}/customer?${qs}`} replace />
  }

  function goToStep(next: CheckoutStep) {
    navigate(`/checkout/${vehicleId}/${next}?${qs}`)
  }

  // See CustomerDetailsPage/DriverDetailsPage's former comment: the
  // validators' own message text stays English/UX-only; translate by
  // field-name key instead.
  function translatedCustomerError(field: keyof CustomerFieldErrors) {
    return customerFieldErrors[field] ? t(`checkout.customer.errors.${field}`) : undefined
  }
  function translatedDriverError(field: keyof DriverFieldErrors) {
    return driverFieldErrors[field] ? t(`checkout.driver.errors.${field}`) : undefined
  }

  function handleCustomerSubmit(e: FormEvent) {
    e.preventDefault()
    setCustomerTouched(true)
    const fieldErrors = validateCustomerDraft(draft.customer)
    setCustomerFieldErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) {
      revealFirstError()
      return
    }
    goToStep('driver')
  }

  function handleCustomerChange(patch: Partial<CustomerDraft>) {
    updateCustomer(patch)
    if (customerTouched) setCustomerFieldErrors(validateCustomerDraft({ ...draft.customer, ...patch }))
  }

  function handleDriverSubmit(e: FormEvent) {
    e.preventDefault()
    setDriverTouched(true)
    const fieldErrors = validateDriverDraft(draft.customer, draft.driver, criteria!.endDate)
    setDriverFieldErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) {
      revealFirstError()
      return
    }
    goToStep('summary')
  }

  function handleDriverChange(patch: Partial<DriverDraft>) {
    updateDriver(patch)
    if (driverTouched) setDriverFieldErrors(validateDriverDraft(draft.customer, { ...draft.driver, ...patch }, criteria!.endDate))
  }

  const days = rentalDays(criteria.startDate, criteria.endDate)
  const estimatedQuote = quoteForDays(vehicle.pricing, days)
  const driverIdentity = effectiveDriverIdentity(draft.customer, draft.driver)

  // Defensive re-check (unchanged from the old BookingSummaryPage): the
  // Customer/Driver steps already validate their own fields before letting
  // the customer move on, but Review has no editable fields of its own to
  // show a per-field error on — so if it's ever reached with incomplete
  // data (an old bookmark, a stale draft from before a schema change, or
  // manual back/forward), send the customer straight back to whichever
  // step is actually incomplete instead of attempting a doomed API call.
  const customerValidation = validateCustomerDraft(draft.customer)
  const driverValidation = validateDriverDraft(draft.customer, draft.driver, criteria.endDate)
  const incompleteStep: 'customer' | 'driver' | null =
    Object.keys(customerValidation).length > 0 ? 'customer' : Object.keys(driverValidation).length > 0 ? 'driver' : null

  // Before ever calling create-booking, check whether this exact vehicle +
  // these exact dates/locations already produced a pending booking earlier
  // in this same checkout session (e.g. Payment → Back to Review). If so,
  // this is a RESUME, not a new attempt — see checkoutStorage.ts's header
  // comment for the full root-cause writeup on why create-booking must
  // never be called twice for the same pending trip.
  const resumable: ActiveBookingPointer | null = ignoreResumable ? null : readActiveBooking(vehicleId!, criteria)

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

  const customerEditHref = `/checkout/${vehicleId}/customer?${qs}`
  const driverEditHref = `/checkout/${vehicleId}/driver?${qs}`

  return (
    <CheckoutStepLayout
      stepIndex={STEP_INDEX[step]}
      title={t(`checkout.${step}.title`)}
      vehicle={vehicle}
      startDate={criteria.startDate}
      endDate={criteria.endDate}
      pickup={pickup}
      dropoff={dropoff}
      showTripInCard={false}
      total={
        step === 'summary' && resumable
          ? { label: t('checkout.payment.amountDue'), amount: resumable.totalPrice, currency: resumable.currency }
          : undefined
      }
    >
      {step === 'customer' && (
        <>
          <Card className="p-4! sm:p-5!">
            <p className="mb-4 text-sm text-text-muted">{t('checkout.customer.note')}</p>
            <form id="customer-details-form" onSubmit={handleCustomerSubmit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:gap-4">
                <TextField
                  label={t('checkout.customer.firstName')}
                  value={draft.customer.firstName}
                  onChange={(e) => handleCustomerChange({ firstName: e.target.value })}
                  placeholder={t('checkout.customer.firstNamePlaceholder')}
                  autoComplete="given-name"
                  error={translatedCustomerError('firstName')}
                  required
                />
                <TextField
                  label={t('checkout.customer.lastName')}
                  value={draft.customer.lastName}
                  onChange={(e) => handleCustomerChange({ lastName: e.target.value })}
                  placeholder={t('checkout.customer.lastNamePlaceholder')}
                  autoComplete="family-name"
                  error={translatedCustomerError('lastName')}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <TextField
                  label={t('checkout.customer.email')}
                  type="email"
                  value={draft.customer.email}
                  onChange={(e) => handleCustomerChange({ email: e.target.value })}
                  placeholder="you@example.com"
                  autoComplete="email"
                  error={translatedCustomerError('email')}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <TextField
                  label={t('checkout.customer.phone')}
                  type="tel"
                  value={draft.customer.phone}
                  onChange={(e) => handleCustomerChange({ phone: e.target.value })}
                  placeholder="+971 5X XXX XXXX"
                  autoComplete="tel"
                  error={translatedCustomerError('phone')}
                  hint={t('checkout.customer.phoneHint')}
                  required
                />
              </div>
            </form>
          </Card>

          <CheckoutActions>
            <Button type="submit" form="customer-details-form" size="compact" className={ACTION_BUTTON_CLASS}>
              <CtaLabel short={t('checkout.customer.continueShort')} full={t('checkout.customer.continue')} />
              <ArrowRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
            </Button>
          </CheckoutActions>
        </>
      )}

      {step === 'driver' && (
        <>
          <CompletedStepCard title={t('checkout.customer.title')} editHref={customerEditHref} editLabel={t('checkout.editStep')}>
            {`${draft.customer.firstName} ${draft.customer.lastName}`.trim() || '—'}
            {draft.customer.email ? ` · ${draft.customer.email}` : ''}
            {draft.customer.phone ? ` · ${draft.customer.phone}` : ''}
          </CompletedStepCard>

          <Card className="p-4! sm:p-5!">
            <p className="mb-4 text-sm text-text-muted">{t('checkout.driver.intro')}</p>

            <form id="driver-details-form" onSubmit={handleDriverSubmit} noValidate className="space-y-4">
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('checkout.driver.whoDrives')}
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <DriverToggleOption
                    selected={draft.driver.isSameAsCustomer}
                    onSelect={() => handleDriverChange({ isSameAsCustomer: true })}
                    label={t('checkout.driver.iAmDriver')}
                  />
                  <DriverToggleOption
                    selected={!draft.driver.isSameAsCustomer}
                    onSelect={() => handleDriverChange({ isSameAsCustomer: false })}
                    label={t('checkout.driver.someoneElse')}
                  />
                </div>
              </fieldset>

              {draft.driver.isSameAsCustomer ? (
                <div className="rounded-none bg-brand-lavender/40 px-3 py-2.5 text-sm text-brand-navy">
                  <p className="font-semibold">{t('checkout.driver.sameAsCustomerTitle')}</p>
                  <p className="mt-1 break-words text-text-muted">
                    {draft.customer.firstName || draft.customer.lastName
                      ? `${draft.customer.firstName} ${draft.customer.lastName}`.trim()
                      : t('checkout.driver.sameAsCustomerNoName')}
                    {draft.customer.phone ? ` · ${draft.customer.phone}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">{t('checkout.driver.sameAsCustomerHint')}</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <TextField
                      label={t('checkout.driver.firstName')}
                      value={draft.driver.firstName}
                      onChange={(e) => handleDriverChange({ firstName: e.target.value })}
                      placeholder={t('checkout.driver.firstNamePlaceholder')}
                      error={translatedDriverError('firstName')}
                      required
                    />
                    <TextField
                      label={t('checkout.driver.lastName')}
                      value={draft.driver.lastName}
                      onChange={(e) => handleDriverChange({ lastName: e.target.value })}
                      placeholder={t('checkout.driver.lastNamePlaceholder')}
                      error={translatedDriverError('lastName')}
                      required
                    />
                  </div>
                  <TextField
                    label={t('checkout.driver.phone')}
                    type="tel"
                    value={draft.driver.phone}
                    onChange={(e) => handleDriverChange({ phone: e.target.value })}
                    placeholder="+971 5X XXX XXXX"
                    error={translatedDriverError('phone')}
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 sm:gap-4">
                <div className="col-span-2 lg:col-span-1">
                  <TextField
                    label={t('checkout.driver.licenseNumber')}
                    value={draft.driver.licenseNumber}
                    onChange={(e) => handleDriverChange({ licenseNumber: e.target.value })}
                    error={translatedDriverError('licenseNumber')}
                    required
                  />
                </div>
                <TextField
                  label={t('checkout.driver.licenseCountry')}
                  value={draft.driver.licenseCountry}
                  onChange={(e) => handleDriverChange({ licenseCountry: e.target.value })}
                  placeholder={t('checkout.driver.licenseCountryPlaceholder')}
                  error={translatedDriverError('licenseCountry')}
                  required
                />
                <div className="lg:col-span-2">
                  <DateField
                    label={t('checkout.driver.licenseExpiry')}
                    value={draft.driver.licenseExpiry}
                    onChange={(e) => handleDriverChange({ licenseExpiry: e.target.value })}
                    error={translatedDriverError('licenseExpiry')}
                    className="min-w-0"
                    required
                  />
                </div>
              </div>

              <p className="text-xs text-text-muted">{t('checkout.driver.note')}</p>
            </form>
          </Card>

          <CheckoutActions backTo={customerEditHref}>
            <Button type="submit" form="driver-details-form" size="compact" className={ACTION_BUTTON_CLASS}>
              <CtaLabel short={t('checkout.driver.continueShort')} full={t('checkout.driver.continue')} />
              <ArrowRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
            </Button>
          </CheckoutActions>
        </>
      )}

      {step === 'summary' && (
        <>
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
                <Block title={t('checkout.summary.customerSection')} icon={ContactRound} editHref={customerEditHref} editLabel={t('checkout.editStep')}>
                  <Row label={t('checkout.summary.name')} value={`${draft.customer.firstName} ${draft.customer.lastName}`.trim() || '—'} />
                  <Row label={t('checkout.summary.email')} value={draft.customer.email || '—'} />
                  <Row label={t('checkout.summary.phone')} value={draft.customer.phone || '—'} />
                </Block>

                <Block
                  title={t('checkout.summary.driverSection')}
                  icon={IdCard}
                  editHref={driverEditHref}
                  editLabel={t('checkout.editStep')}
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
                    to={incompleteStep === 'customer' ? customerEditHref : driverEditHref}
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

          <CheckoutActions backTo={driverEditHref}>
            {resumable ? (
              <Button size="compact" className={ACTION_BUTTON_CLASS} onClick={() => goToPayment(resumable.bookingId)}>
                <CtaLabel short={t('checkout.summary.resumeContinueShort')} full={t('checkout.summary.resumeContinue')} />
                <ArrowRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
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
                {submitting ? (
                  <CtaLabel short={t('checkout.summary.confirmingShort')} full={t('checkout.summary.confirming')} />
                ) : (
                  <>
                    <CtaLabel short={t('checkout.summary.confirmShort')} full={t('checkout.summary.confirm')} />
                    <ArrowRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
                  </>
                )}
              </Button>
            )}
          </CheckoutActions>
        </>
      )}
    </CheckoutStepLayout>
  )
}

/**
 * The sticky action bar is narrow on a phone (it shares the row with the
 * Back control and the price), too narrow for the full "Continue to driver
 * details"-style copy to fit on one line at a legible size — it wrapped
 * onto two lines with the arrow orphaned on its own row. Below `sm`, show
 * a single short word instead; from `sm` up there is room for the full,
 * more descriptive label. Both variants stay in the DOM (so screen readers
 * on either breakpoint always get real text), CSS just shows one at a time.
 */
function CtaLabel({ short, full }: { short: string; full: string }) {
  return (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{full}</span>
    </>
  )
}

/**
 * A finished step, collapsed into a compact read-only recap with an "Edit"
 * link back to it — shown above the step that comes next so the customer
 * can see (and fix, without retyping anything) what they already entered.
 * The gold checkmark badge mirrors the "done" state in the stepper above,
 * so "this is finished" reads at a glance without repeating the step icon.
 */
function CompletedStepCard({
  title,
  editHref,
  editLabel,
  children,
}: {
  title: string
  editHref: string
  editLabel: string
  children: ReactNode
}) {
  return (
    <div className="mb-3 border border-brand-navy/10 bg-brand-lavender/15 p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center bg-brand-gold text-white">
            <Check className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={3} />
          </span>
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-brand-navy">{title}</h2>
        </div>
        <Link
          to={editHref}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-navy underline underline-offset-2 hover:text-brand-gold-dark"
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
          {editLabel}
        </Link>
      </div>
      <p className="mt-2 min-w-0 truncate text-sm text-text-muted">{children}</p>
    </div>
  )
}

/**
 * The outer button follows the site's rounded-none redesign; the small
 * indicator inside it deliberately stays circular — it's a genuine
 * radio-button affordance (pick exactly one of two options), and that
 * shape is a near-universal convention users rely on to recognize
 * "choose one" at a glance, not a decorative choice the sharp-editorial
 * radius rule was meant to cover.
 */
function DriverToggleOption({ selected, onSelect, label }: { selected: boolean; onSelect: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={
        'flex min-h-12 items-center gap-2 rounded-none border px-3 py-2.5 text-start text-xs font-semibold transition-colors sm:gap-3 sm:text-sm ' +
        (selected
          ? 'border-brand-navy bg-brand-navy text-white'
          : 'border-border bg-white text-brand-navy hover:border-brand-navy/40')
      }
    >
      <span
        aria-hidden="true"
        className={
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ' +
          (selected ? 'border-white' : 'border-border')
        }
      >
        {selected && <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
      {label}
    </button>
  )
}

/** A titled group of rows, tight enough that a review page needs little scrolling. */
function Block({
  title,
  icon,
  className = '',
  columns = false,
  editHref,
  editLabel,
  children,
}: {
  title: string
  icon: LucideIcon
  className?: string
  /** Pair trip rows while the panel is full width; use single rows beside pricing. */
  columns?: boolean
  /** Shown on the Review step so a completed section can be jumped back to and fixed without retyping anything. */
  editHref?: string
  editLabel?: string
  children: ReactNode
}) {
  return (
    <div className={`min-w-0 p-4 ${className}`}>
      <SectionTitle title={title} icon={icon} editHref={editHref} editLabel={editLabel} />
      <dl className={columns ? 'mt-2.5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-1' : 'mt-2.5 space-y-2 text-sm'}>{children}</dl>
    </div>
  )
}

function Section({
  title,
  icon,
  columns = false,
  className = '',
  children,
}: {
  title: string
  icon: LucideIcon
  columns?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`min-w-0 border border-brand-navy/10 bg-white ${className}`}>
      <Block title={title} icon={icon} columns={columns}>
        {children}
      </Block>
    </section>
  )
}

function SectionTitle({ title, icon: Icon, editHref, editLabel }: { title: string; icon: LucideIcon; editHref?: string; editLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-brand-navy/10 pb-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center bg-brand-navy text-white">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-brand-navy">{title}</h2>
      </div>
      {editHref && editLabel && (
        <Link to={editHref} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-navy underline underline-offset-2 hover:text-brand-gold-dark">
          <Pencil className="h-3 w-3" aria-hidden="true" />
          {editLabel}
        </Link>
      )}
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
