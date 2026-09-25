import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Car, CalendarRange, CreditCard } from 'lucide-react'
import { lookupBooking, BookingLookupError } from '@/features/booking/lookupApi'
import { lastNameMatches } from '@/features/booking/manageBookingVerify'
import { ExtendRentalSection } from '@/features/booking/ExtendRentalSection'
import { resumePendingBookingFromLookup, clearActiveBooking } from '@/features/booking/checkout/checkoutStorage'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { ManageBookingHero } from '@/features/booking/ManageBookingHero'
import { BookingStatusTimeline } from '@/features/booking/BookingStatusTimeline'
import { ResultCard, ResultRow } from '@/features/booking/BookingResultCard'
import { Button, StatusBadge } from '@/features/shared/ui'
import { CurrencySymbol } from '@/features/shared/ui/CurrencySymbol'
import { useDocumentTitle, useMetaDescription } from '@/lib/useDocumentTitle'
import { prefersReducedMotion } from '@/lib/motion'
import { daysRemaining } from '@/lib/dateRange'
import { PAYMENT_LOGOS } from '@/lib/paymentLogos'
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
 * Frontend simplification (airline "manage booking" reference): the
 * two-column steps/form lookup card became a plain, compact two-field
 * form — booking reference/plate + last name, verified together via
 * manageBookingVerify.ts's lastNameMatches (the same helper the homepage
 * navigator's ManageBookingVerifyPanel already uses). This page's lookup
 * used to accept the reference or plate ALONE; it now requires the last
 * name to match too, same as that navigator panel. `handleSubmit` below
 * does the required-fields check, then the lookup, then the last-name
 * check — a mismatch or a nonexistent reference both land on the same
 * generic 'not_found' state, so neither ever reveals which was wrong.
 *
 * Full redesign (drop the hero): per a direct follow-up request, the page
 * no longer opens with a hero at all — ManageBookingHero is now a plain,
 * flat text header (eyebrow + rule + heading, no photo) instead of the
 * full-bleed PageHero treatment above. The outer wrapper here dropped the
 * warm-surface background and the lookup card's negative-margin overlap
 * (both existed only to sit a white card over a photo that no longer
 * exists) for a single flat white page instead. No lookup/verification
 * logic changed — only this file's own layout wrapper and which
 * components it renders.
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
 *
 * Merge (direct follow-up request, "commercial-grade" redesign): the
 * separate read-only /find-my-car page (BookingStatusPanel — a single-
 * field, reference-only lookup limited to Client Name / Car / Car Number
 * / Days Left) is retired. /find-my-car now redirects here (App.tsx),
 * the same way /extend-rental already redirects here. This page's own
 * two-field, last-name-verified lookup was already the safer, more
 * complete one — and it's the one every transactional email already
 * deep-links to (manageBookingLink.ts) — so there is now exactly one
 * lookup, one URL, one nav link, answering the "title says one thing, the
 * URL opens another" complaint directly. The old split existed to solve
 * "a guest who only wants a quick status check shouldn't be shown extend/
 * payment actions"; this rebuild answers that differently — the found
 * result now leads with a status strip (reference, badge, days left) and
 * a visual progress timeline (BookingStatusTimeline.tsx, modeled on
 * checkout's own CheckoutStepper) before the detailed Vehicle/Trip/
 * Actions cards, so the quick answer is still the first thing on screen,
 * on the one page. ManageBookingHero.tsx also drops its flat text-only
 * header for a proper heading + trust bullets, no stock photo, per the
 * same request — and, since a found result replaces it entirely below
 * (see the render), the visitor is never left scrolling past a still-full
 * finder to reach the answer they already have.
 *
 * Direct follow-up (the first pass here used a full solid navy band for
 * the hero, and always kept the hero mounted above the result): both
 * corrected. The site's own rule is no solid navy box fills (see
 * index.css's `.white-box` note) — the hero is plain white with a
 * `.white-box` card around the form, no navy, no gradient. And the hero
 * now only renders for `status !== 'found'` (below) — it used to stay
 * mounted underneath a `scrollIntoView` to the result, which meant
 * scrolling back up from the result surfaced the entire finder again,
 * reported as "the page above it is showing again."
 */
export function ManageBookingPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('manageBooking.title'))
  useMetaDescription('Manage your Bliss Rent booking — view your reservation, extend your rental, or continue to payment with your booking reference or vehicle plate.')
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const prefetchedResult = (location.state as { prefetchedResult?: BookingLookupResult } | null)?.prefetchedResult
  const [query, setQuery] = useState(() => prefetchedResult?.bookingReference ?? searchParams.get('ref') ?? '')
  const [lastName, setLastName] = useState('')
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
    if (!query.trim() || !lastName.trim()) {
      setState({ status: 'error', message: t('manageBooking.errorRequired') })
      return
    }
    setState({ status: 'loading' })
    try {
      const result = await lookupBooking(query)
      if (result && lastNameMatches(result.customerName, lastName)) {
        setState({ status: 'found', result })
        // Defensive cleanup: if this browser still has an active-booking
        // pointer for this vehicle (e.g. a stale tab) but the booking is
        // no longer pending_payment (paid, cancelled, reassigned…), drop
        // the pointer so the header reminder and BookingSummaryPage's
        // resume panel never show something that's already resolved.
        if (result.bookingStatus !== 'pending_payment') clearActiveBooking(result.vehicleId)
      } else {
        // Deliberately the same generic state whether the reference/plate
        // doesn't exist or the last name doesn't match it — never reveal
        // which (see ManageBookingVerifyPanel, which does the same).
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
    setLastName('')
    const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
    // The hero/lookup card unmounts while a result is showing (see the
    // render below) and remounts the instant status flips back to 'idle'
    // above — wait a tick so it's back in the DOM before scrolling to it.
    requestAnimationFrame(() => {
      if (typeof lookupSectionRef.current?.scrollIntoView === 'function') {
        lookupSectionRef.current.scrollIntoView({ behavior, block: 'start' })
      }
    })
  }

  return (
    <div>
      {/* The finder only shows while there's nothing to show yet — once a
          booking is found, it gets out of the way (handleSearchAnother
          below brings it back) instead of sitting there as a wall of
          content the visitor has to scroll past to reach their result. */}
      {state.status !== 'found' && (
        <div ref={lookupSectionRef} className="scroll-mt-24">
          <ManageBookingHero
            query={query}
            onQueryChange={setQuery}
            lastName={lastName}
            onLastNameChange={setLastName}
            onSubmit={(e) => void handleSubmit(e)}
            loading={state.status === 'loading'}
            notFound={state.status === 'not_found'}
            errorMessage={state.status === 'error' ? state.message : null}
          />
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {state.status === 'found' && (
          <div className="pt-10 sm:pt-14">
            <BookingResult result={state.result} sectionRef={resultSectionRef} onSearchAnother={handleSearchAnother} />
          </div>
        )}

        <div className="mt-10 pb-14 text-center sm:pb-20">
          <Link to="/" className="text-sm font-semibold text-brand-navy underline decoration-brand-gold decoration-2 underline-offset-4">
            {t('checkout.confirmation.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}

function BookingResult({
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
  const hasActions = canExtend || canResumePayment

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
    <div ref={sectionRef} tabIndex={-1} role="region" aria-label={t('manageBooking.resultLabel')} className="scroll-mt-24 outline-none">
      {/* The quick answer, unmissable and first on screen — this is what
          used to be a whole separate page (Booking Status). */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-brand-navy/10 bg-[linear-gradient(180deg,#ffffff_0%,#f9f5f1_100%)] p-5 shadow-sm sm:p-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold-dark">{t('manageBooking.resultLabel')}</p>
          <span className="mt-2 block font-mono text-base font-semibold text-brand-navy">{result.bookingReference}</span>
        </div>
        <div className="flex items-center gap-4">
          {canExtend && (
            <div className="text-end">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('home.navigator.status.result.daysLeft')}</p>
              <p className="font-hero-serif text-3xl font-semibold tracking-[-0.03em] text-brand-navy">
                {t('home.navigator.status.result.daysLeftValue', { count: daysRemaining(result.endDate) })}
              </p>
            </div>
          )}
          <StatusBadge status={result.bookingStatus} translationPrefix="admin.status" />
        </div>
      </div>

      <div className="mt-5 border border-brand-navy/10 p-5 sm:p-6">
        <BookingStatusTimeline status={result.bookingStatus} />
      </div>

      <div className={'mt-5 grid gap-4 ' + (hasActions ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
        <ResultCard icon={Car} title={t('checkout.confirmation.vehicle')}>
          <div className="border-b border-brand-navy/10 pb-4">
            <p className="font-hero-serif text-2xl font-semibold tracking-[-0.03em] text-brand-navy">
              {result.vehicleMake} {result.vehicleModel}
            </p>
            <p className="mt-1 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{result.vehiclePlate}</p>
          </div>
          <ResultRow label={t('checkout.confirmation.customer')} value={result.customerName} />
        </ResultCard>

        <ResultCard icon={CalendarRange} title={t('home.navigator.manage.result.tripHeading')}>
          <ResultRow label={t('checkout.confirmation.rentalDates')} value={`${result.startDate} → ${result.endDate}`} />
          <ResultRow label={t('checkout.confirmation.pickup')} value={result.pickupLocationName} />
          <ResultRow label={t('checkout.confirmation.dropoff')} value={result.dropoffLocationName} />
          <div className="mt-1 border-t border-brand-navy/10 pt-4">
            <ResultRow
              label={t('checkout.confirmation.amount')}
              value={<><CurrencySymbol currency={result.currency} /> {result.totalPrice.toLocaleString()}</>}
              strong
            />
            <ResultRow label={t('checkout.confirmation.paymentStatus')} value={<StatusBadge status={result.paymentStatus} translationPrefix="admin.status" />} />
          </div>
        </ResultCard>

        {hasActions && (
          <ResultCard icon={CreditCard} title={canExtend ? t('extendRental.sectionTitle') : t('manageBooking.result.paymentCardTitle')} emphasis>
            {canResumePayment && (
              <div className="space-y-4">
                <p className="text-sm leading-6 text-text-muted">{t('manageBooking.result.paymentCardBody')}</p>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{t('footer.weAccept')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PAYMENT_LOGOS.map((logo) => (
                      <span key={logo.name} className="flex h-9 w-13 items-center justify-center rounded-md border border-brand-navy/10 bg-white">
                        <svg viewBox="0 0 24 24" role="img" aria-label={logo.name} className="h-5.5 w-5.5">
                          <path d={logo.path} fill={`#${logo.hex}`} />
                        </svg>
                      </span>
                    ))}
                  </div>
                </div>
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
          </ResultCard>
        )}
      </div>

      <div className="mt-6 border-t border-brand-navy/10 pt-6">
        <Button variant="outline" onClick={onSearchAnother} fullWidthOnMobile>
          {t('manageBooking.searchAnother')}
        </Button>
      </div>
    </div>
  )
}
