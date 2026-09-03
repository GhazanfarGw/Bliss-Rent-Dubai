import type { BookingConfirmationSnapshot, BookingCreationResult, BookingLookupResult } from '@/types/domain'
import { EMPTY_CUSTOMER_DRAFT, EMPTY_DRIVER_DRAFT } from '@/types/domain'

/**
 * Guest checkout has no server-side session, so the result of
 * create-booking (needed by the Payment step) and the final confirmation
 * details (needed by the Confirmation page, including after a refresh)
 * are both captured here, in sessionStorage, keyed by booking id — the
 * same pattern and same reasoning as useCheckoutDraft.ts. Every read/
 * write is wrapped in try/catch: sessionStorage can throw in some
 * browser contexts, and losing this is a "please start over" UX, not a
 * crash.
 */
function bookingKey(bookingId: string): string {
  return `dxb-booking-result:${bookingId}`
}
function confirmationKey(bookingId: string): string {
  return `dxb-confirmation:${bookingId}`
}

export function saveBookingResult(result: BookingCreationResult) {
  try {
    sessionStorage.setItem(bookingKey(result.bookingId), JSON.stringify(result))
  } catch {
    // best-effort only
  }
}

export function readBookingResult(bookingId: string): BookingCreationResult | null {
  try {
    const raw = sessionStorage.getItem(bookingKey(bookingId))
    return raw ? (JSON.parse(raw) as BookingCreationResult) : null
  } catch {
    return null
  }
}

export function saveConfirmationSnapshot(snapshot: BookingConfirmationSnapshot) {
  try {
    sessionStorage.setItem(confirmationKey(snapshot.bookingId), JSON.stringify(snapshot))
  } catch {
    // best-effort only
  }
}

export function readConfirmationSnapshot(bookingId: string): BookingConfirmationSnapshot | null {
  try {
    const raw = sessionStorage.getItem(confirmationKey(bookingId))
    return raw ? (JSON.parse(raw) as BookingConfirmationSnapshot) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Checkout / Payment Flow Recovery (2026-09-15)
//
// ROOT CAUSE this section fixes: BookingSummaryPage used to call
// create-booking unconditionally on every "Confirm" click. Payment → Back
// to Summary → Confirm again therefore tried to create a SECOND booking
// for the same vehicle/dates — which the bookings_no_overlap exclusion
// constraint correctly rejects, because it overlaps the customer's own
// still-pending first booking. The server was right to reject it; the
// frontend just had no memory of "I already made this booking" to avoid
// asking again. Reproduced directly against production data (booking
// BLS-E16F5DC3) before this fix — see the migration header for details.
//
// `ActiveBookingPointer` is that memory: saved once, right after
// create-booking succeeds, keyed per vehicle AND mirrored into one global
// "pending booking" slot. BookingSummaryPage reads the per-vehicle
// pointer (only trusting it if dates/locations still match) to decide
// resume-vs-create-new. NavBar reads the global slot for the header
// reminder icon — scoped, by design, to "this browser tab's own single
// unpaid booking", not a real multi-item cart (guest checkout has no
// account to hang one off).
// ---------------------------------------------------------------------------

export interface ActiveBookingPointer {
  vehicleId: string
  vehicleMake: string
  vehicleModel: string
  startDate: string
  endDate: string
  pickupLocationId: string
  dropoffLocationId: string
  pickupLocationName: string
  dropoffLocationName: string
  bookingId: string
  bookingReference: string
  paymentId: string
  totalPrice: number
  currency: string
}

/** Fired on `window` whenever the pending-booking indicator changes, so NavBar can re-render in the same tab — sessionStorage's own `storage` event never fires for the tab that made the write. */
export const PENDING_BOOKING_EVENT = 'dxb-pending-booking-changed'

const PENDING_BOOKING_KEY = 'dxb-pending-booking'

function activeBookingKey(vehicleId: string): string {
  return `dxb-active-booking:${vehicleId}`
}

function criteriaMatches(
  pointer: ActiveBookingPointer,
  criteria: { startDate: string; endDate: string; pickupLocationId: string; dropoffLocationId: string },
): boolean {
  return (
    pointer.startDate === criteria.startDate &&
    pointer.endDate === criteria.endDate &&
    pointer.pickupLocationId === criteria.pickupLocationId &&
    pointer.dropoffLocationId === criteria.dropoffLocationId
  )
}

function notifyPendingBookingChanged() {
  try {
    window.dispatchEvent(new Event(PENDING_BOOKING_EVENT))
  } catch {
    // no window (e.g. a non-DOM test context) — nothing to notify
  }
}

/** Call once, immediately after a create-booking call succeeds (or after resuming a booking found via Manage Booking) — records "this browser already has a pending booking for this vehicle/dates" so a later Confirm click can resume it instead of re-submitting. */
export function saveActiveBooking(pointer: ActiveBookingPointer) {
  try {
    sessionStorage.setItem(activeBookingKey(pointer.vehicleId), JSON.stringify(pointer))
    sessionStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(pointer))
  } catch {
    // best-effort only
  }
  notifyPendingBookingChanged()
}

/** Returns the saved pointer for this vehicle ONLY if it still matches the given dates/locations — if the customer went back and changed either, this correctly returns null so a genuinely new booking is created. */
export function readActiveBooking(
  vehicleId: string,
  criteria: { startDate: string; endDate: string; pickupLocationId: string; dropoffLocationId: string },
): ActiveBookingPointer | null {
  try {
    const raw = sessionStorage.getItem(activeBookingKey(vehicleId))
    if (!raw) return null
    const pointer = JSON.parse(raw) as ActiveBookingPointer
    return criteriaMatches(pointer, criteria) ? pointer : null
  } catch {
    return null
  }
}

/** Call once a booking's payment is resolved (paid) or the booking is otherwise no longer usefully resumable — stops it being offered as "resume" and clears the header reminder if it was the one showing. */
export function clearActiveBooking(vehicleId: string) {
  try {
    sessionStorage.removeItem(activeBookingKey(vehicleId))
    const raw = sessionStorage.getItem(PENDING_BOOKING_KEY)
    if (raw) {
      const current = JSON.parse(raw) as ActiveBookingPointer
      if (current.vehicleId === vehicleId) sessionStorage.removeItem(PENDING_BOOKING_KEY)
    }
  } catch {
    // best-effort only
  }
  notifyPendingBookingChanged()
}

/** This browser tab's single "you have an unpaid booking" reminder — read by the NavBar header icon. Deliberately the most-recently-saved pointer only, not a true multi-item cart. */
export function readPendingBookingIndicator(): ActiveBookingPointer | null {
  try {
    const raw = sessionStorage.getItem(PENDING_BOOKING_KEY)
    return raw ? (JSON.parse(raw) as ActiveBookingPointer) : null
  } catch {
    return null
  }
}

function checkoutDraftKey(vehicleId: string): string {
  return `dxb-checkout:${vehicleId}`
}

/**
 * Manage Booking → "Continue to Payment" (brief item 4): resumes a
 * `pending_payment` booking found via the booking-reference/plate lookup
 * — a DIFFERENT browser/session than the one that created it, so none of
 * the usual sessionStorage state exists yet. Seeds exactly what
 * PaymentPage needs (so it doesn't show "not found") and mirrors into the
 * same active-booking pointer BookingSummaryPage/NavBar use, WITHOUT ever
 * calling create-booking again or touching availability.
 *
 * The lookup is deliberately guest-safe and non-sensitive (see
 * lookup_booking_for_customer's own migration comment: no license/
 * document fields, no phone, no email) — so only the customer's full
 * name can be pre-filled into the checkout draft here. Email/phone and
 * every driver field are left blank; the only effect is cosmetic, on the
 * eventual Confirmation page's customer/driver name display for this one
 * resume path, never on the actual booking/payment record.
 */
export function resumePendingBookingFromLookup(result: BookingLookupResult) {
  saveBookingResult({
    bookingId: result.bookingId,
    bookingReference: result.bookingReference,
    customerId: '',
    driverId: '',
    paymentId: result.paymentId,
    status: result.bookingStatus,
    term: '',
    unitPrice: 0,
    totalPrice: result.totalPrice,
    currency: result.currency,
    days: 0,
  })

  saveActiveBooking({
    vehicleId: result.vehicleId,
    vehicleMake: result.vehicleMake,
    vehicleModel: result.vehicleModel,
    startDate: result.startDate,
    endDate: result.endDate,
    pickupLocationId: result.pickupLocationId,
    dropoffLocationId: result.dropoffLocationId,
    pickupLocationName: result.pickupLocationName,
    dropoffLocationName: result.dropoffLocationName,
    bookingId: result.bookingId,
    bookingReference: result.bookingReference,
    paymentId: result.paymentId,
    totalPrice: result.totalPrice,
    currency: result.currency,
  })

  try {
    const existing = sessionStorage.getItem(checkoutDraftKey(result.vehicleId))
    if (!existing) {
      sessionStorage.setItem(
        checkoutDraftKey(result.vehicleId),
        JSON.stringify({
          vehicleId: result.vehicleId,
          criteria: {
            startDate: result.startDate,
            endDate: result.endDate,
            pickupLocationId: result.pickupLocationId,
            dropoffLocationId: result.dropoffLocationId,
          },
          customer: { ...EMPTY_CUSTOMER_DRAFT, fullName: result.customerName },
          driver: EMPTY_DRIVER_DRAFT,
        }),
      )
    }
  } catch {
    // best-effort only — PaymentPage still works without a draft; only the Confirmation page's name display is affected.
  }
}
