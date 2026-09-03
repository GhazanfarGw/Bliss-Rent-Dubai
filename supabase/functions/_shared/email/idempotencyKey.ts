// Idempotency key builders for the email_log table (see
// supabase/migrations/20260911000000_phase9_email_log_table.sql for the
// unique index this feeds). Pure, framework-free — no Deno APIs, no
// Supabase client — same shape as every other `_shared` module.
//
// Two shapes, per Section 16 of the Phase 9 Pre-Implementation Report:
//   - a once-per-booking event (e.g. "booking confirmed") never needs
//     more than the booking id and the event type — a second attempt to
//     send that same event for that same booking must collide.
//   - an event that can legitimately repeat for the same booking (e.g. a
//     generic status change, which can happen more than once over a
//     booking's lifetime) folds in the id of the specific row that
//     triggered this send, so each occurrence gets its own key while a
//     retry of THIS occurrence still collides correctly.
//
// Both are exported as distinct, clearly-named functions rather than one
// function with an optional third argument, so a call site can't
// accidentally omit the triggering row id for a repeatable event and
// silently collapse every occurrence into one key.

export function buildOncePerBookingKey(bookingId: string, eventType: string): string {
  assertNonEmpty(bookingId, 'bookingId')
  assertNonEmpty(eventType, 'eventType')
  return `booking:${bookingId}:${eventType}`
}

export function buildRepeatableEventKey(bookingId: string, eventType: string, triggeringRowId: string): string {
  assertNonEmpty(bookingId, 'bookingId')
  assertNonEmpty(eventType, 'eventType')
  assertNonEmpty(triggeringRowId, 'triggeringRowId')
  return `booking:${bookingId}:${eventType}:${triggeringRowId}`
}

/**
 * Phase 9H — the one non-booking event this table's own migration comment
 * anticipated ("a future non-booking admin notice"): a Contact Us
 * complaint has no booking to key off. Same shape as
 * buildRepeatableEventKey, with a `complaint:` prefix instead of
 * `booking:` so a complaint id and a booking id can never collide in the
 * same idempotency-key space. `discriminator` plays the same role it
 * does there — the recipient admin's own id, so a complaint notification
 * fanning out to multiple active admins gives each one its own key.
 */
export function buildComplaintEventKey(complaintId: string, eventType: string, discriminator: string): string {
  assertNonEmpty(complaintId, 'complaintId')
  assertNonEmpty(eventType, 'eventType')
  assertNonEmpty(discriminator, 'discriminator')
  return `complaint:${complaintId}:${eventType}:${discriminator}`
}

function assertNonEmpty(value: string, name: string): void {
  if (!value || !value.trim()) {
    throw new Error(`buildIdempotencyKey: ${name} must be a non-empty string`)
  }
}
