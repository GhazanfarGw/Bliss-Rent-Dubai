import { supabase } from '@/lib/supabaseClient'
import type { BookingLookupResult } from '@/types/domain'

export class BookingLookupError extends Error {}

/**
 * Manage Booking — single-field lookup. Guest checkout has no auth session
 * (see ConfirmationPage.tsx / docs/ARCHITECTURE.md), so this is the only
 * way a customer can check their booking status later, from a different
 * browser or device, or after their same-browser sessionStorage
 * confirmation snapshot is gone.
 *
 * Follow-up request (made directly in chat, after Phase 7 shipped):
 * replace the original reference+email pairing with ONE field that
 * accepts EITHER the booking reference OR the vehicle's plate number.
 * This is a deliberate, owner-approved reduction from this project's usual
 * "two values must match together" pattern — see the
 * lookup_booking_for_customer() migration's own header for the full
 * trade-off explanation. Calls that SECURITY DEFINER RPC, which returns
 * zero rows when the query matches neither a reference nor a plate.
 */
export async function lookupBooking(query: string): Promise<BookingLookupResult | null> {
  const { data, error } = await supabase.rpc('lookup_booking_for_customer', {
    p_query: query.trim(),
  })

  if (error) throw new BookingLookupError(error.message)
  const row = data?.[0]
  if (!row) return null

  return {
    bookingId: row.booking_id,
    bookingReference: row.booking_reference,
    bookingStatus: row.booking_status,
    startDate: row.start_date,
    endDate: row.end_date,
    totalPrice: row.total_price,
    currency: row.currency,
    vehicleId: row.vehicle_id,
    vehicleMake: row.vehicle_make,
    vehicleModel: row.vehicle_model,
    vehiclePlate: row.vehicle_plate,
    pickupLocationId: row.pickup_location_id,
    dropoffLocationId: row.dropoff_location_id,
    pickupLocationName: row.pickup_location_name,
    dropoffLocationName: row.dropoff_location_name,
    customerName: row.customer_name,
    paymentId: row.payment_id,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
  }
}
