import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'
import type { AdminBookingWithDetails, AdminBookingStatusHistoryEntry } from '@/types/domain'
import type { Database } from '@/types/database'

type BookingStatus = Database['public']['Tables']['bookings']['Row']['status']

const BOOKING_SELECT =
  '*, customers(*), vehicles(*, vehicle_categories(*)), pickup_location:locations!bookings_pickup_location_id_fkey(*), dropoff_location:locations!bookings_dropoff_location_id_fkey(*), drivers(*), payments(*)'

export async function fetchBookings(status: BookingStatus | 'all'): Promise<AdminBookingWithDetails[]> {
  let query = supabase.from('bookings').select(BOOKING_SELECT).order('created_at', { ascending: false })
  if (status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new AdminApiError(error.message)
  return (data ?? []) as unknown as AdminBookingWithDetails[]
}

/**
 * Lightweight count-only query (no row data) for the admin sidebar's
 * "needs attention" badge — bookings that have been created but not yet
 * paid for. Uses `head: true` so Supabase returns just the count, not the
 * matching rows.
 */
export async function fetchPendingBookingsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_payment')
  if (error) throw new AdminApiError(error.message)
  return count ?? 0
}

export async function fetchBookingById(id: string): Promise<AdminBookingWithDetails | null> {
  const { data, error } = await supabase.from('bookings').select(BOOKING_SELECT).eq('id', id).maybeSingle()
  if (error) throw new AdminApiError(error.message)
  return data as unknown as AdminBookingWithDetails | null
}

export async function fetchBookingStatusHistory(bookingId: string): Promise<AdminBookingStatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from('booking_status_history')
    .select('*')
    .eq('booking_id', bookingId)
    .order('changed_at', { ascending: false })
  if (error) throw new AdminApiError(error.message)
  return data ?? []
}

/**
 * Phase 11: replaces the old unrestricted `updateBookingStatus(bookingId,
 * status)` — a bare RLS UPDATE that let any admin set a booking to any
 * status with no payment-consistency check (see
 * claude/phase-11-premium-booking-admin-audit-and-plan-2026-09-02.md §0).
 * Admins no longer have direct UPDATE on `bookings` at all (see the RLS
 * policy comment in 20260917000000_phase11_controlled_booking_status_actions.sql)
 * — every status transition now goes through one of these three
 * Super-Admin-only, idempotent RPCs. The DB trigger
 * (`handle_booking_status_change`) still validates the transition graph
 * and writes booking_status_history + a generic audit_logs row; each RPC
 * additionally writes its own named audit_logs row.
 *
 * The customer/admin cancellation emails below are unchanged from the
 * old updateBookingStatus — same Edge Functions, same best-effort
 * (logged, never thrown) semantics — just moved onto the new RPC path.
 */
export async function adminCancelBooking(bookingId: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_cancel_booking', {
    p_booking_id: bookingId,
    p_note: note?.trim() ? note.trim() : null,
  })
  if (error) throw new AdminApiError(error.message)

  try {
    const { error: emailError } = await supabase.functions.invoke('send-customer-email', {
      body: { bookingId, eventType: 'booking_cancelled' },
    })
    if (emailError) {
      console.error('send-customer-email (booking_cancelled) failed', emailError)
    }
  } catch (err) {
    console.error('send-customer-email (booking_cancelled) failed', err)
  }

  try {
    const { error: adminEmailError } = await supabase.functions.invoke('notify-admin-booking-cancelled', {
      body: { bookingId },
    })
    if (adminEmailError) {
      console.error('notify-admin-booking-cancelled failed', adminEmailError)
    }
  } catch (err) {
    console.error('notify-admin-booking-cancelled failed', err)
  }
}

/** Super-Admin-only controlled confirmed->active transition ("Start Rental"). See admin_start_rental RPC. */
export async function adminStartRental(bookingId: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_start_rental', {
    p_booking_id: bookingId,
    p_note: note?.trim() ? note.trim() : null,
  })
  if (error) throw new AdminApiError(error.message)
}

/** Super-Admin-only controlled active->completed transition ("Mark Returned"). See admin_mark_returned RPC. */
export async function adminMarkReturned(bookingId: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_mark_returned', {
    p_booking_id: bookingId,
    p_note: note?.trim() ? note.trim() : null,
  })
  if (error) throw new AdminApiError(error.message)
}

/**
 * Super-Admin-only manual "mark paid" for an ORIGINAL booking stuck in
 * pending_payment — the checkout-recovery counterpart to
 * confirmExtensionPayment (adminExtensionsApi.ts), same is_super_admin()
 * gate enforced inside the RPC itself (a stale role in memory can never
 * bypass it). See supabase/migrations/20260915000000_checkout_resume_payment.sql.
 */
export async function adminConfirmBookingPayment(bookingId: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_confirm_booking_payment', {
    p_booking_id: bookingId,
    p_note: note?.trim() ? note.trim() : null,
  })
  if (error) throw new AdminApiError(error.message)
}

export interface AdminConfirmBookingVehicleResult {
  bookingId: string
  vehicleId: string
  plateNumber: string
  isNewPhysicalVehicle: boolean
  changed: boolean
}

/**
 * Phase 14 — Super-Admin-only. Confirms the real plate for a booking's
 * Reserved copy (see admin_confirm_booking_vehicle RPC,
 * supabase/migrations/20261001000000_phase14_reserved_vehicle_copies.sql):
 * a NEW plate turns the Reserved copy into a new physical vehicle
 * (inventory +1); an EXISTING plate atomically repoints the booking onto
 * that existing physical vehicle (after re-checking the date range is
 * still free) and retires the temporary Reserved copy — Decision 1's
 * "one real physical vehicle, one real plate" rule, reusing the same
 * conflict-safe pattern as Phase 7 vehicle reassignment.
 *
 * After the RPC succeeds, best-effort (never throwing) triggers the
 * plate_confirmed customer email + WhatsApp dispatch — same
 * fire-and-forget convention as adminCancelBooking's emails above and
 * adminExtensionsApi.ts's triggerExtensionNotificationEmails. A failure
 * here never rolls back or hides the already-committed plate
 * confirmation; it's just logged, since the notification record was
 * already durably written by the RPC and can be redelivered later.
 */
export async function adminConfirmBookingVehicle(
  bookingId: string,
  plateNumber: string,
  note?: string,
): Promise<AdminConfirmBookingVehicleResult> {
  const { data, error } = await supabase.rpc('admin_confirm_booking_vehicle', {
    p_booking_id: bookingId,
    p_plate_number: plateNumber.trim(),
    p_note: note?.trim() ? note.trim() : null,
  })
  if (error) throw new AdminApiError(error.message)

  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new AdminApiError('admin_confirm_booking_vehicle returned no result.')

  try {
    const { error: notifyError } = await supabase.functions.invoke('deliver-plate-confirmation-notifications', {
      body: { bookingId },
    })
    if (notifyError) {
      console.error('deliver-plate-confirmation-notifications failed', notifyError)
    }
  } catch (err) {
    console.error('deliver-plate-confirmation-notifications failed', err)
  }

  return {
    bookingId: row.booking_id,
    vehicleId: row.vehicle_id,
    plateNumber: row.plate_number,
    isNewPhysicalVehicle: row.is_new_physical_vehicle,
    changed: row.changed,
  }
}

/** Signed, short-lived URL for a private driver document. Never a public URL — see the driver-documents storage policy (admin read-only). */
export async function fetchDriverDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('driver-documents').createSignedUrl(path, 60)
  if (error) throw new AdminApiError(error.message)
  return data.signedUrl
}
