// Shared error contract between both Phase 2 Edge Functions and the
// frontend (src/features/booking/checkout/checkoutApi.ts mirrors these
// codes so the UI can show a specific, friendly message per case instead
// of a generic "something went wrong").
export type BookingErrorCode =
  | 'VALIDATION_ERROR'
  | 'VEHICLE_NOT_FOUND'
  | 'VEHICLE_UNAVAILABLE'
  | 'INVALID_LOCATION'
  | 'NO_PRICING'
  | 'PAYMENT_NOT_FOUND'
  | 'ALREADY_RESOLVED'
  | 'SERVER_ERROR'

export class ApiError extends Error {
  code: BookingErrorCode
  httpStatus: number
  fieldErrors?: Record<string, string>

  constructor(
    code: BookingErrorCode,
    message: string,
    httpStatus: number,
    fieldErrors?: Record<string, string>,
  ) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
    this.fieldErrors = fieldErrors
  }
}

/**
 * Turns a raw Postgres/PostgREST error (from a failed `.rpc()` call) into
 * one of our typed ApiErrors. This is the single place that interprets
 * what the database is telling us, so both Edge Functions stay
 * consistent about it.
 */
export function mapDatabaseError(error: { code?: string; message?: string }): ApiError {
  const message = error.message ?? ''

  // 23P01 = exclusion_violation — the bookings_no_overlap constraint from
  // Phase 0 fired, meaning another booking took this vehicle/date-range
  // between search and checkout.
  if (error.code === '23P01' || message.includes('bookings_no_overlap')) {
    return new ApiError(
      'VEHICLE_UNAVAILABLE',
      'This vehicle was just booked for overlapping dates by someone else. Please choose another vehicle or date range.',
      409,
    )
  }
  if (message.includes('vehicle not found')) {
    return new ApiError('VEHICLE_NOT_FOUND', 'That vehicle could not be found.', 404)
  }
  if (message.includes('vehicle is not available')) {
    return new ApiError(
      'VEHICLE_UNAVAILABLE',
      'This vehicle is no longer available for booking.',
      409,
    )
  }
  if (message.includes('pickup location') || message.includes('drop-off location')) {
    return new ApiError('INVALID_LOCATION', 'Please choose a valid Dubai pickup and drop-off point.', 422)
  }
  if (message.includes('payment not found')) {
    return new ApiError('PAYMENT_NOT_FOUND', 'That payment could not be found.', 404)
  }

  return new ApiError('SERVER_ERROR', 'Something went wrong while processing your booking. Please try again.', 500)
}
