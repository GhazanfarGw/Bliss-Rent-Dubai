// Pure, framework-free request handler for the create-booking Edge
// Function. `index.ts` is the only file in this directory that touches
// Deno-specific APIs (Deno.serve, Deno.env) — everything that matters is
// here, so it can be unit-tested under Vitest with a mocked Supabase
// client, exactly like the rest of this codebase.
//
// ONE AUTHORITATIVE PRICING PATH: the price charged for a booking is
// computed by calling `resolveTermForDays` / `quoteForDays` from
// src/lib/pricing.ts — the SAME functions, same file, Phase 1 already
// built and tested for on-site price display. This function never
// re-derives pricing itself and the browser never sends a price at all;
// it only ever sends a vehicle id and a date range.
import { quoteForDays } from '../../../src/lib/pricing.ts'
import { validateDateRange, rentalDays } from '../../../src/lib/dateRange.ts'
import { validateCustomer, validateDriver, type CustomerInput, type DriverInput } from '../_shared/validation.ts'
import { ApiError, mapDatabaseError } from '../_shared/errors.ts'

export interface CreateBookingRequestBody {
  vehicleId?: string
  startDate?: string
  endDate?: string
  pickupLocationId?: string
  dropoffLocationId?: string
  customer?: Partial<CustomerInput>
  driver?: Partial<DriverInput>
}

export interface CreateBookingResult {
  bookingId: string
  bookingReference: string
  customerId: string
  driverId: string
  paymentId: string
  status: string
  term: string
  unitPrice: number
  totalPrice: number
  currency: string
  days: number
}

interface PricingRow {
  term: string
  list_price: number
  client_price: number
  currency: string
}

/** The minimal slice of the supabase-js client surface this function needs — kept narrow so tests can supply a lightweight fake instead of a real client. */
export interface SupabaseLike {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): Promise<{ data: PricingRow[] | null; error: { message: string } | null }>
    }
  }
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }>
}

function requireString(value: unknown, field: string, errors: Record<string, string>): string {
  if (typeof value !== 'string' || value.trim() === '') {
    errors[field] = `${field} is required.`
    return ''
  }
  return value
}

export async function handleCreateBooking(
  body: CreateBookingRequestBody,
  supabase: SupabaseLike,
): Promise<CreateBookingResult> {
  const fieldErrors: Record<string, string> = {}

  const vehicleId = requireString(body.vehicleId, 'vehicleId', fieldErrors)
  const pickupLocationId = requireString(body.pickupLocationId, 'pickupLocationId', fieldErrors)
  const dropoffLocationId = requireString(body.dropoffLocationId, 'dropoffLocationId', fieldErrors)

  const dateCheck = validateDateRange(body.startDate, body.endDate)
  if (!dateCheck.valid) {
    fieldErrors['dates'] = dateCheck.error ?? 'Invalid dates.'
  }

  Object.assign(fieldErrors, validateCustomer(body.customer ?? {}))

  // Driver validation needs real dates to check license-expiry-vs-rental
  // and driver-age-vs-rental-start; only run it once the dates are
  // themselves valid, so we don't compound two separate error messages
  // about the same broken date into a confusing driver-field error too.
  if (dateCheck.valid && body.startDate && body.endDate) {
    Object.assign(fieldErrors, validateDriver(body.driver ?? {}, body.startDate, body.endDate))
  } else if (!body.driver || Object.keys(body.driver).length === 0) {
    fieldErrors['driver.fullName'] = 'Driver details are required.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError('VALIDATION_ERROR', 'Please check the highlighted fields.', 422, fieldErrors)
  }

  const startDate = body.startDate as string
  const endDate = body.endDate as string
  const days = rentalDays(startDate, endDate)

  const { data: pricingRows, error: pricingError } = await supabase
    .from('pricing')
    .select('term, list_price, client_price, currency')
    .eq('vehicle_id', vehicleId)

  if (pricingError) throw mapDatabaseError(pricingError)

  const quote = quoteForDays(
    (pricingRows ?? []).map((r) => ({
      id: '',
      vehicle_id: vehicleId,
      term: r.term as never,
      list_price: r.list_price,
      client_price: r.client_price,
      currency: r.currency,
      created_at: '',
    })),
    days,
  )

  if (!quote) {
    throw new ApiError('NO_PRICING', 'This vehicle has no pricing configured yet and cannot be booked.', 422)
  }

  const customer = body.customer as CustomerInput
  const driver = body.driver as DriverInput

  const { data, error } = await supabase.rpc('create_booking', {
    p_vehicle_id: vehicleId,
    p_pickup_location_id: pickupLocationId,
    p_dropoff_location_id: dropoffLocationId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_term: quote.term,
    p_unit_price: quote.unitPrice,
    p_total_price: quote.totalPrice,
    p_currency: quote.currency,
    p_customer_full_name: customer.fullName.trim(),
    p_customer_email: customer.email.trim().toLowerCase(),
    p_customer_phone: customer.phone ? customer.phone.trim() : null,
    p_driver_full_name: driver.fullName.trim(),
    p_driver_date_of_birth: driver.dateOfBirth,
    p_driver_license_number: driver.licenseNumber.trim(),
    p_driver_license_country: driver.licenseCountry.trim(),
    p_driver_license_expiry: driver.licenseExpiry,
    p_payment_provider: 'test',
  })

  if (error) throw mapDatabaseError(error)
  const row = data?.[0]
  if (!row) throw new ApiError('SERVER_ERROR', 'Booking creation did not return a result.', 500)

  return {
    bookingId: row.booking_id as string,
    bookingReference: row.booking_reference as string,
    customerId: row.customer_id as string,
    driverId: row.driver_id as string,
    paymentId: row.payment_id as string,
    status: row.status as string,
    term: quote.term,
    unitPrice: quote.unitPrice,
    totalPrice: row.total_price as number,
    currency: row.currency as string,
    days,
  }
}
