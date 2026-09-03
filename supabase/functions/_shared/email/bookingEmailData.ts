// Phase 9D — fetches the data a customer booking email needs, straight
// from the database, and formats it exactly the way the rest of the app
// already displays a booking (ConfirmationPage.tsx / ManageBookingPage.tsx):
// `${startDate} → ${endDate}` for dates, `${currency} ${amount.toLocaleString()}`
// for money, `${make} ${model}` for the vehicle. No new formatting
// convention is introduced here.
//
// This is also where the "never trust a client-supplied recipient"
// requirement actually gets satisfied end-to-end: the caller passes only
// a `bookingId`; every other field — including the email address — comes
// back from this query against the service-role-authenticated database,
// never from a request body.

import { formatBookingReference } from '../../../../src/lib/bookingReference.ts'
import type { BookingSummary } from './types.ts'
import type { CustomerRecipientSource } from './recipient.ts'

export interface BookingEmailRow {
  id: string
  status: string
  start_date: string
  end_date: string
  total_price: number
  currency: string
  customers: CustomerRecipientSource | null
  vehicles: { make: string; model: string } | null
  pickup_location: { name: string } | null
  dropoff_location: { name: string } | null
}

/** The minimal slice of the supabase-js client surface this module needs — narrow on purpose so tests can supply a lightweight fake, same convention as create-booking/logic.ts's SupabaseLike. */
export interface BookingEmailDataSource {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: BookingEmailRow | null; error: { message: string } | null }>
      }
    }
  }
}

export const BOOKING_EMAIL_SELECT =
  'id, status, start_date, end_date, total_price, currency, customers(full_name, email), vehicles(make, model), pickup_location:locations!bookings_pickup_location_id_fkey(name), dropoff_location:locations!bookings_dropoff_location_id_fkey(name)'

export class BookingEmailDataError extends Error {}

export async function fetchBookingEmailRow(supabase: BookingEmailDataSource, bookingId: string): Promise<BookingEmailRow> {
  const { data, error } = await supabase.from('bookings').select(BOOKING_EMAIL_SELECT).eq('id', bookingId).maybeSingle()
  if (error) throw new BookingEmailDataError(`fetchBookingEmailRow: ${error.message}`)
  if (!data) throw new BookingEmailDataError(`fetchBookingEmailRow: no booking found for id ${bookingId}`)
  return data
}

export interface BookingSummaryOptions {
  paymentStatusLabel?: string
  bookingStatusLabel?: string
}

export function buildBookingSummaryFromRow(row: BookingEmailRow, options: BookingSummaryOptions = {}): BookingSummary {
  const vehicleName = row.vehicles ? `${row.vehicles.make} ${row.vehicles.model}` : 'Vehicle'
  return {
    reference: formatBookingReference(row.id),
    vehicleName,
    rentalDatesLabel: `${row.start_date} → ${row.end_date}`,
    pickupLabel: row.pickup_location?.name ?? '—',
    dropoffLabel: row.dropoff_location?.name ?? '—',
    amountLabel: `${row.currency} ${row.total_price.toLocaleString()}`,
    paymentStatusLabel: options.paymentStatusLabel,
    bookingStatusLabel: options.bookingStatusLabel,
  }
}
