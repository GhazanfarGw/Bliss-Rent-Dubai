import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  readPendingBookingIndicator,
  clearActiveBooking,
  PENDING_BOOKING_EVENT,
  type ActiveBookingPointer,
} from '@/features/booking/checkout/checkoutStorage'
import { lookupBooking } from '@/features/booking/lookupApi'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { Button } from '@/features/shared/ui'

/**
 * Header "My Booking" reminder (brief items 12-13). Deliberately scoped
 * to THIS browser tab's single unpaid booking — sessionStorage has no
 * concept of a real multi-item cart, and guest checkout has no account
 * to hang one off (confirmed directly with the owner). Shows nothing at
 * all when there's no pending booking, so it never reads as a misleading
 * count. Re-reads on every route change and whenever checkoutStorage
 * fires PENDING_BOOKING_EVENT (create-booking success, payment success,
 * or a stale pointer getting cleaned up), since sessionStorage writes
 * don't otherwise trigger a re-render in this same tab.
 *
 * BUG FIX (reported: reminder kept showing a booking that no longer
 * existed after an admin data reset): this pointer is pure client-side
 * sessionStorage with no expiry — it used to be trusted forever, with
 * nothing ever re-checking it against the server after it was first
 * saved. If the browser tab outlives the booking (paid/cancelled from
 * another device, or the underlying row is gone entirely, e.g. an admin
 * reset/test-data wipe), the reminder had no way to find out and kept
 * showing stale details with a "Continue to payment" button that led
 * nowhere real. Now validates the pointer once per bookingId via the
 * same guest-safe `lookup_booking_for_customer` RPC Manage Booking
 * already uses, and silently clears it (same `clearActiveBooking` used
 * everywhere else this pointer is invalidated) when the booking is gone
 * or no longer `pending_payment` — mirroring the exact defensive-cleanup
 * pattern already used in ManageBookingPage.tsx, just applied on load
 * instead of only after a manual lookup.
 */
export function PendingBookingIndicator() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [pending, setPending] = useState<ActiveBookingPointer | null>(null)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Tracks which bookingId has already been checked against the server
  // this page-load, so re-renders / route changes / the same pointer
  // reappearing don't re-fire the lookup RPC repeatedly.
  const validatedBookingId = useRef<string | null>(null)

  useEffect(() => {
    function refresh() {
      setPending(readPendingBookingIndicator())
    }
    refresh()
    window.addEventListener(PENDING_BOOKING_EVENT, refresh)
    return () => window.removeEventListener(PENDING_BOOKING_EVENT, refresh)
  }, [])

  useEffect(() => {
    if (!pending) return
    if (validatedBookingId.current === pending.bookingId) return
    validatedBookingId.current = pending.bookingId

    let cancelled = false
    lookupBooking(pending.bookingReference)
      .then((result) => {
        if (cancelled) return
        // Not found (row gone entirely — e.g. an admin data reset) or
        // resolved to something other than still-awaiting-payment: this
        // reminder is stale, so drop it exactly like every other place
        // that invalidates this pointer.
        if (!result || result.bookingStatus !== 'pending_payment') {
          clearActiveBooking(pending.vehicleId)
        }
      })
      .catch(() => {
        // Best-effort only — a transient network/lookup error should
        // never falsely clear a real pending booking, so just leave the
        // reminder as-is and let the next mount/route-change try again.
      })
    return () => {
      cancelled = true
    }
  }, [pending])

  // Also refresh on navigation (e.g. right after a payment succeeds and
  // the pointer was cleared) — the event above already covers same-tick
  // clears, this is a cheap belt-and-suspenders re-sync.
  useEffect(() => {
    setPending(readPendingBookingIndicator())
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (!pending) return null

  function handleContinue() {
    if (!pending) return
    const qs = criteriaToSearchParams({
      startDate: pending.startDate,
      endDate: pending.endDate,
      pickupLocationId: pending.pickupLocationId,
      dropoffLocationId: pending.dropoffLocationId,
    }).toString()
    setOpen(false)
    navigate(`/checkout/${pending.vehicleId}/payment/${pending.bookingId}?${qs}`)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('nav.pendingBooking.label')}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-none border border-[#e6e1d9] bg-[#f7f4ef] text-brand-navy shadow-sm transition-colors hover:bg-[#f1eee8]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l1.5-5A2 2 0 0 1 6.4 4.5h11.2a2 2 0 0 1 1.9 1.5L21 11" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 11h18v6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6Z" />
          <circle cx="7.5" cy="15" r="1.25" fill="currentColor" stroke="none" />
          <circle cx="16.5" cy="15" r="1.25" fill="currentColor" stroke="none" />
        </svg>
        <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-champagne px-1 text-[10px] font-bold text-brand-navy">
          1
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('nav.pendingBooking.panelLabel')}
          // Below `lg`, this button sits in the middle of the mobile header
          // (language switcher + hamburger still to its right), so anchoring
          // the panel to the BUTTON via `absolute end-0` let a 320px-wide
          // panel overshoot off the left edge of the screen on narrow
          // viewports — exactly the overlap/alignment bug reported. Fixed by
          // anchoring to the VIEWPORT instead (`fixed inset-x-4`) below `lg`,
          // clearing the fixed header with a flat `top-20` (comfortably above
          // both the 4rem and 4.5rem/transparent header heights). From `lg`
          // up the button is part of the right-aligned desktop nav cluster,
          // where anchoring to the button itself is safe again.
          className="fixed inset-x-4 top-20 z-50 rounded-none border border-brand-navy/10 bg-white p-4 text-start shadow-[0_20px_38px_rgba(18,20,23,0.14)] lg:absolute lg:inset-x-auto lg:end-0 lg:top-12 lg:w-80 lg:max-w-[calc(100vw-2rem)]"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold-dark">
            {t('nav.pendingBooking.title')}
          </p>
          <p className="mt-2 text-sm font-semibold text-brand-navy">
            {pending.vehicleMake} {pending.vehicleModel}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {pending.startDate} → {pending.endDate}
          </p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-text-muted">{t('checkout.payment.bookingReference')}</span>
            <span className="font-mono font-semibold text-brand-navy">{pending.bookingReference}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-text-muted">{t('checkout.payment.amountDue')}</span>
            <span className="font-semibold text-brand-navy">
              {pending.currency} {pending.totalPrice.toLocaleString()}
            </span>
          </div>
          <Button onClick={handleContinue} fullWidthOnMobile className="mt-4 w-full">
            {t('checkout.summary.resumeContinue')}
          </Button>
        </div>
      )}
    </div>
  )
}
