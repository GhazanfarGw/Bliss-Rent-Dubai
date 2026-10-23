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
