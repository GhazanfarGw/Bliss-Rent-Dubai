import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { lookupBooking, BookingLookupError } from '@/features/booking/lookupApi'
import { ExtendRentalSection } from '@/features/booking/ExtendRentalSection'
import { resumePendingBookingFromLookup, clearActiveBooking } from '@/features/booking/checkout/checkoutStorage'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { ManageBookingHero } from '@/features/booking/ManageBookingHero'
import { ManageBookingLookupCard } from '@/features/booking/ManageBookingLookupCard'
import { Button, StatusBadge } from '@/features/shared/ui'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import { prefersReducedMotion } from '@/lib/motion'
import type { BookingLookupResult } from '@/types/domain'

type ViewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | { status: 'found'; result: BookingLookupResult }

const EXTENDABLE_STATUSES = new Set(['confirmed', 'active'])

/**
 * Booking Status — merged "check my booking" + "extend my rental" page.
 *
 * Originally two separate screens (Phase 6's reference+email lookup, and
 * the Phase 7 reassignment respec's reference+vehicle-number Extend
 * Rental page). Merged per a direct follow-up request: one single field
 * — the booking reference OR the vehicle's plate number, either alone —
 * finds the booking, and if it's in a state that can still be extended,
 * the extend-request form (ExtendRentalSection) appears right below the
 * result instead of sending the customer to a second page. See
 * lookupApi.ts and the lookup_booking_for_customer() migration for the
 * deliberate single-field trade-off this relies on.
 *
 * Phase 9D: every booking/payment email's "Manage your booking" button
 * links here as `/manage-booking?ref=BLS-XXXXXXXX` (buildManageBookingUrl,
 * _shared/email/manageBookingLink.ts). The `ref` query parameter only
 * pre-fills the lookup field below — it does not auto-submit — so the
 * existing lookup behavior (the customer reviews the reference, then
 * presses the button) is unchanged either way.
 *
 * Phase 11 correction: the homepage navigator's Manage Booking panel
 * (ManageBookingVerifyPanel.tsx) now verifies the reference + last name
 * up front, then hands off here via `navigate('/manage-booking', { state:
 * { prefetchedResult } })` so the customer isn't asked to look their
 * booking up a second time. When present, `location.state.prefetchedResult`
 * seeds the result straight into the "found" state below — reusing the
 * exact same ResultCard/ExtendRentalSection/Continue-to-Payment code, no
 * new booking logic. Navigating here normally (no state, e.g. the `ref`
 * query param above, or a direct visit) behaves exactly as before.
 *
 * Frontend redesign (full page + header link): the page now opens with
 * its own hero (ManageBookingHero) and a purpose-built lookup UI
 * (ManageBookingLookupCard) instead of the earlier compact dark card —
 * a deliberately different look from SearchWidget/BookingNavigator's
 * tab-and-pill treatment, per the "same car find navigator everywhere"
 * feedback. All state, the `lookupBooking()` call, and every view-state
 * branch below are byte-for-byte the same as before; only the JSX these
 * two components render has changed. NavBar now links here directly
 * (`nav.manageBooking`), so this is reachable from every page's header,
 * not only from an email link or the homepage navigator's Manage
 * Booking tab.
 *
 * Frontend UX fix: a successful lookup used to render the result far
 * below the lookup card with no scroll/focus transition, so a customer
 * could easily miss that anything happened. `resultSectionRef` below is
 * scrolled/focused into view any time `state.status` becomes `'found'` —
 * including the very first render for the `prefetchedResult` handoff
 * path, since that path already starts in the `'found'` state and this
 * effect runs after every render, mount included. None of the lookup
 * logic, RPC call, or booking data itself changed — only where the
 * user's attention goes once the result exists. `handleSearchAnother`
 * (wired to the new "Search another booking" action in ResultCard) just
 * resets the same view state back to `'idle'` and clears the query field
 * — it does not re-implement or bypass the existing lookup flow.
 */
export function ManageBookingPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('manageBooking.title'))
  useMetaDescription('Manage your Bliss Rent booking — view your reservation, extend your rental, or continue to payment with your booking reference or vehicle plate.')
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const prefetchedResult = (location.state as { prefetchedResult?: BookingLookupResult } | null)?.prefetchedResult
  const [query, setQuery] = useState(() => prefetchedResult?.bookingReference ?? searchParams.get('ref') ?? '')
  const [state, setState] = useState<ViewState>(() =>
    prefetchedResult ? { status: 'found', result: prefetchedResult } : { status: 'idle' },
  )
  const resultSectionRef = useRef<HTMLDivElement>(null)
  const lookupSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Mirrors the same defensive cleanup handleSubmit does below, for the
    // pre-verified arrival path.
    if (prefetchedResult && prefetchedResult.bookingStatus !== 'pending_payment') {
      clearActiveBooking(prefetchedResult.vehicleId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only ever meant to run once, for the initial prefetched result
  }, [])

  // Make the result the user's primary visible state: scroll/focus to it
  // the moment a lookup succeeds. Runs after every render where the
  // status is 'found', so it also covers the initial mount for the
  // prefetchedResult handoff path (that path starts already 'found').
  useEffect(() => {
    if (state.status !== 'found') return
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
    // jsdom (unit tests) doesn't implement scrollIntoView at all — guard so
    // the real browser behavior isn't test-only code.
    if (typeof resultSectionRef.current?.scrollIntoView === 'function') {
      resultSectionRef.current.scrollIntoView({ behavior, block: 'start' })
    }
    resultSectionRef.current?.focus({ preventScroll: true })
  }, [state.status])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setState({ status: 'loading' })
    try {
      const result = await lookupBooking(query)
      if (result) {
        setState({ status: 'found', result })
        // Defensive cleanup: if this browser still has an active-booking
        // pointer for this vehicle (e.g. a stale tab) but the booking is
        // no longer pending_payment (paid, cancelled, reassigned…), drop
        // the pointer so the header reminder and BookingSummaryPage's
        // resume panel never show something that's already resolved.
        if (result.bookingStatus !== 'pending_payment') clearActiveBooking(result.vehicleId)
      } else {
        setState({ status: 'not_found' })
      }
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof BookingLookupError ? err.message : t('manageBooking.genericError'),
      })
    }
  }

  function handleSearchAnother() {
    setState({ status: 'idle' })
    setQuery('')
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
    // Wait a tick so the lookup card (always mounted, but scrolled past
    // once a result is showing) is back in normal flow before scrolling.
    requestAnimationFrame(() => {
      if (typeof lookupSectionRef.current?.scrollIntoView === 'function') {
        lookupSectionRef.current.scrollIntoView({ behavior, block: 'start' })
      }
    })
  }

  return (
    <div className="bg-surface-warm">
      <ManageBookingHero />

      <div className="mx-auto max-w-4xl px-4 pb-14 sm:px-6 lg:px-8 mt-28 md:32">
        <div ref={lookupSectionRef} className="scroll-mt-24">
          <ManageBookingLookupCard
            query={query}
            onQueryChange={setQuery}
            onSubmit={(e) => void handleSubmit(e)}
            loading={state.status === 'loading'}
            notFound={state.status === 'not_found'}
            errorMessage={state.status === 'error' ? state.message : null}
          />
        </div>

        {state.status === 'found' && (
          <ResultCard result={state.result} sectionRef={resultSectionRef} onSearchAnother={handleSearchAnother} />
        )}

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm font-semibold text-brand-navy underline decoration-brand-gold decoration-2 underline-offset-4">
            {t('checkout.confirmation.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}

function ResultCard({
  result,
  sectionRef,
  onSearchAnother,
}: {
  result: BookingLookupResult
  sectionRef: RefObject<HTMLDivElement | null>
  onSearchAnother: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const canExtend = EXTENDABLE_STATUSES.has(result.bookingStatus)
  const canResumePayment = result.bookingStatus === 'pending_payment'

  function handleContinueToPayment() {
    // Resume the EXISTING booking found above — never re-run
    // create-booking, never re-check availability. See
    // resumePendingBookingFromLookup for exactly what state this seeds.
    resumePendingBookingFromLookup(result)
    const qs = criteriaToSearchParams({
      startDate: result.startDate,
      endDate: result.endDate,
      pickupLocationId: result.pickupLocationId,
      dropoffLocationId: result.dropoffLocationId,
    }).toString()
    navigate(`/checkout/${result.vehicleId}/payment/${result.bookingId}?${qs}`)
  }

  return (
    <div
      ref={sectionRef}
      tabIndex={-1}
      role="region"
      aria-label={t('manageBooking.resultLabel')}
      className="mt-6 scroll-mt-24 space-y-4 border border-[#ece7df] bg-white p-6 shadow-[0_20px_38px_rgba(18,20,23,0.06)] outline-none sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-navy/8 pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold-dark">{t('manageBooking.resultLabel')}</p>
          <span className="mt-2 block font-mono text-base font-semibold text-brand-navy">{result.bookingReference}</span>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={result.bookingStatus} translationPrefix="admin.status" />
        </div>
      </div>
      <Row label={t('checkout.confirmation.vehicle')} value={`${result.vehicleMake} ${result.vehicleModel}`} />
      <Row label={t('extendRental.vehicleNumberLabel')} value={result.vehiclePlate} />
      <Row label={t('checkout.confirmation.rentalDates')} value={`${result.startDate} → ${result.endDate}`} />
      <Row label={t('checkout.confirmation.pickup')} value={result.pickupLocationName} />
      <Row label={t('checkout.confirmation.dropoff')} value={result.dropoffLocationName} />
      <Row label={t('checkout.confirmation.customer')} value={result.customerName} />
      <Row label={t('checkout.confirmation.amount')} value={`${result.currency} ${result.totalPrice.toLocaleString()}`} />
      <Row label={t('checkout.confirmation.paymentStatus')} value={<StatusBadge status={result.paymentStatus} translationPrefix="admin.status" />} />

      {canResumePayment && (
        <div className="border-t border-brand-navy/8 pt-4">
          <Button onClick={handleContinueToPayment} fullWidthOnMobile>
            {t('manageBooking.continueToPayment')}
          </Button>
        </div>
      )}

      {canExtend && (
        <ExtendRentalSection
          bookingReference={result.bookingReference}
          vehicleNumber={result.vehiclePlate}
          currentReturnDate={result.endDate}
          vehicleId={result.vehicleId}
          originalStartDate={result.startDate}
          currentTotalPrice={result.totalPrice}
          currency={result.currency}
        />
      )}

      <div className="border-t border-brand-navy/8 pt-4">
        <Button variant="outline" onClick={onSearchAnother} fullWidthOnMobile>
          {t('manageBooking.searchAnother')}
        </Button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="text-right font-medium capitalize text-brand-navy">
        {typeof value === 'string' ? value.replace(/_/g, ' ') : value}
      </span>
    </div>
  )
}
