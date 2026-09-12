// Phase 9D — customer recipient resolution.
//
// Security requirement (Phase 9 Pre-Implementation Report, Section 20):
// "Recipient address always resolved server-side from the booking's own
// customers.email — never taken from client input at send time."
//
// This is enforced structurally, not just by convention: the function
// below has no parameter through which a caller COULD pass a
// client-supplied email address — its only input is the customer record
// as read back from the database (via bookingEmailData.ts, which queries
// `bookings`/`customers` with the service-role client). Even for a
// booking that was just created from data the browser submitted, the
// email actually sent to is whatever ended up durably stored in the
// `customers` row after create_booking() ran — not the raw request body
// — so a normalization or dedupe decision made inside that RPC is always
// reflected correctly, and there is no code path that forwards an
// unvalidated request field directly into a send.

export interface CustomerRecipientSource {
  full_name: string | null
  email: string | null
}

export interface CustomerRecipient {
  name: string
  email: string
}

export class MissingRecipientError extends Error {
  constructor(reason: string) {
    super(`Cannot resolve a customer recipient: ${reason}`)
    this.name = 'MissingRecipientError'
  }
}

export function resolveCustomerRecipient(customer: CustomerRecipientSource | null | undefined): CustomerRecipient {
  if (!customer) {
    throw new MissingRecipientError('no customer record was found for this booking')
  }
  const email = customer.email?.trim()
  if (!email) {
    throw new MissingRecipientError('the customer record has no stored email address')
  }
  const name = customer.full_name?.trim() || 'Customer'
  return { name, email }
}
