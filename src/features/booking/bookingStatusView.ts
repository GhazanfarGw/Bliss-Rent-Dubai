import { daysRemaining } from '@/lib/dateRange'
import type { BookingLookupResult } from '@/types/domain'

/**
 * Phase 11 correction — the homepage navigator's Booking Status panel is
 * deliberately minimal: "Do NOT show unnecessary payment information, full
 * booking details, customer private information, pricing, or other data."
 * This pure mapper reduces the same authoritative `BookingLookupResult`
 * (from the existing `lookup_booking_for_customer()` RPC — no second
 * lookup/verification algorithm) down to exactly the four fields the spec
 * asks for, deriving "days left" from the real return date rather than
 * inventing a new field.
 */
export interface BookingStatusSummary {
  clientName: string
  carName: string
  carNumber: string
  daysLeft: number
}

export function toBookingStatusSummary(result: BookingLookupResult, today: Date = new Date()): BookingStatusSummary {
  return {
    clientName: result.customerName,
    carName: `${result.vehicleMake} ${result.vehicleModel}`,
    carNumber: result.vehiclePlate,
    daysLeft: daysRemaining(result.endDate, today),
  }
}
