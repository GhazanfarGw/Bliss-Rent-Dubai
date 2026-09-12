import type { EmailLanguage } from './strings.ts'

export type { EmailLanguage }

/** Visual tone for the status banner at the top of a customer email. */
export type StatusTone = 'info' | 'success' | 'warning' | 'danger'

/** Visual priority for an admin operational email. */
export type AdminPriority = 'normal' | 'attention' | 'urgent'

/**
 * The booking summary card shown in every customer email. Every field
 * is a pre-formatted display string (not a raw value) — formatting
 * (dates, currency, the BLS- reference) happens once, at the call site
 * that has access to `src/lib/pricing.ts` / `src/lib/bookingReference.ts`
 * / `src/lib/dateRange.ts`, exactly as create-booking/logic.ts already
 * does. This module only renders strings; it never reformats data.
 */
export interface BookingSummary {
  reference: string
  vehicleName: string
  rentalDatesLabel: string
  pickupLabel: string
  dropoffLabel: string
  amountLabel: string
  paymentStatusLabel?: string
  bookingStatusLabel?: string
}

export interface CustomerEmailProps {
  language: EmailLanguage
  /** Short, specific title shown right under the brand header, e.g. "Booking confirmed". */
  title: string
  /** One or two sentences of personalized message body, already translated by the caller. */
  message: string
  statusTone: StatusTone
  statusMessage: string
  /**
   * Omitted for a customer email that isn't about any one booking — e.g.
   * Task 3's admin_complaint_reply (2026-09-11), a Contact Us reply that
   * may not reference a booking at all. Every booking-lifecycle email
   * (9D-9J, Phase 14) still always supplies this.
   */
  summary?: BookingSummary
  /** Absolute URL for the primary CTA (built with buildManageBookingUrl). */
  ctaUrl: string
  /** Defaults to strings.manageBooking when omitted. */
  ctaLabel?: string
  /** Rendered HTML body content (already escaped) for a free-form section, e.g. "What happens next" — optional. */
  extraContentHtml?: string
}

export interface AdminEmailProps {
  language: EmailLanguage
  /** e.g. "New booking received", "Extension approved". */
  alertType: string
  priority: AdminPriority
  /**
   * Omitted for an admin alert that isn't about any one booking — e.g. a
   * Phase 9H Contact Us complaint, which may not reference a booking at
   * all. Every 9F event still always supplies this.
   */
  summary?: BookingSummary
  customerName: string
  /** What the admin needs to do, if anything — omit when purely informational. */
  requiredAction?: string
  /**
   * Rendered HTML (already escaped by the caller) for a free-form details
   * block, shown instead of the booking summary card when there's no
   * booking to summarize — e.g. a complaint's subject/message. Omit for a
   * booking-based alert.
   */
  detailsHtml?: string
  dashboardUrl: string
}
