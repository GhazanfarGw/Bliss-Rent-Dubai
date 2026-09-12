// Pure, framework-free request handler for the submit-extension-request
// Edge Function. See create-booking/logic.ts for the same split rationale.
//
// This is the CUSTOMER SELF-SERVICE entry point for the "Extend Rental"
// flow — see supabase/migrations/20260903000000_phase7_booking_reassignment.sql.
// It does exactly one thing: verify the booking reference + vehicle number
// together and insert a 'requested' row via submit_extension_request_public().
// It never checks availability, never computes pricing, never touches
// bookings.end_date, and never auto-approves anything — an admin reviews
// every request from the dashboard.
import { ApiError } from '../_shared/errors.ts'

export interface SubmitExtensionRequestBody {
  bookingReference?: string
  vehicleNumber?: string
  requestedReturnDate?: string
}

export interface SubmitExtensionRequestResult {
  extensionId: string
  status: string
  isLate: boolean
}

export interface SupabaseLike {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }>
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false
  return !Number.isNaN(new Date(value + 'T00:00:00').getTime())
}

/**
 * submit_extension_request_public() only ever raises a plain Postgres
 * exception (no distinguishing SQLSTATE) — the message text IS the
 * signal, and it's already written to be safe to show a customer
 * verbatim (the verification-failure message is deliberately generic
 * about which field was wrong; the "1-30 days" / "cannot be extended"
 * messages are plain business facts about a booking the customer has
 * already proven ownership of). So this just wraps it as a 422, rather
 * than reinterpreting it the way mapDatabaseError does for booking
 * creation — there's no exclusion-violation or not-found case to
 * distinguish here.
 */
function mapExtensionError(message: string): ApiError {
  return new ApiError(
    'VALIDATION_ERROR',
    message || 'We could not process your extension request. Please double-check the details and try again.',
    422,
  )
}

export async function handleSubmitExtensionRequest(
  body: SubmitExtensionRequestBody,
  supabase: SupabaseLike,
): Promise<SubmitExtensionRequestResult> {
  const fieldErrors: Record<string, string> = {}

  const bookingReference = typeof body.bookingReference === 'string' ? body.bookingReference.trim() : ''
  const vehicleNumber = typeof body.vehicleNumber === 'string' ? body.vehicleNumber.trim() : ''
  const requestedReturnDate = typeof body.requestedReturnDate === 'string' ? body.requestedReturnDate.trim() : ''

  if (!bookingReference) fieldErrors.bookingReference = 'Please enter your booking reference.'
  if (!vehicleNumber) fieldErrors.vehicleNumber = 'Please enter the vehicle number on your booking.'
  if (!requestedReturnDate || !isValidIsoDate(requestedReturnDate)) {
    fieldErrors.requestedReturnDate = 'Please choose a valid new return date.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError('VALIDATION_ERROR', 'Please check the highlighted fields.', 422, fieldErrors)
  }

  // No advance-request-window check here on purpose — see the migration
  // comment on submit_extension_request_public(). 1-30 day bound and
  // late-request handling are enforced server-side, in the database.
  const { data, error } = await supabase.rpc('submit_extension_request_public', {
    p_booking_reference: bookingReference,
    p_vehicle_number: vehicleNumber,
    p_requested_return_date: requestedReturnDate,
  })

  if (error) throw mapExtensionError(error.message)
  const row = data?.[0]
  if (!row) {
    throw new ApiError('SERVER_ERROR', 'Your extension request did not go through. Please try again.', 500)
  }

  return {
    extensionId: row.extension_id as string,
    status: row.status as string,
    isLate: Boolean(row.is_late),
  }
}
