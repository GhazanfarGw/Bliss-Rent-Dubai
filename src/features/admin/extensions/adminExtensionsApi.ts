import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'
import type {
  AdminExtensionWithDetails,
  AdminCurrentRentedCar,
  ExtensionPricingSettingsRecord,
  ExtensionPenaltySettingsRecord,
} from '@/types/domain'
import type { Database, ExtensionPricingPolicy, ExtensionPenaltyPolicy, ExtensionStatus } from '@/types/database'

type BookingRow = Database['public']['Tables']['bookings']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']
type PricingRow = Database['public']['Tables']['pricing']['Row']

// booking_extensions has TWO foreign keys into bookings — booking_id (the
// extension's own booking) and conflict_booking_id (the future booking it
// collided with, if any) — see booking_extensions_booking_id_fkey and
// booking_extensions_conflict_booking_id_fkey in
// 20260902000000_phase7_rental_extensions.sql /
// 20260903000000_phase7_booking_reassignment.sql. PostgREST can't infer
// which one `bookings(...)` means with two FKs to the same table, and
// raises "more than one relationship was found for 'booking_extensions'
// and 'bookings'". The explicit `!booking_extensions_booking_id_fkey` hint
// pins this embed to the extension's OWN booking (never the conflicting
// one) — exactly what every consumer of this select already expects.
export const EXTENSION_SELECT =
  '*, bookings!booking_extensions_booking_id_fkey(*, vehicles(*, vehicle_categories(*)), customers(*)), replacement_vehicle:vehicles!booking_extensions_replacement_vehicle_id_fkey(*)'

/** A vehicle-race conflict (Postgres exclusion_violation, 23P01) is always the SAME "someone else already has this exact vehicle for part of these dates" situation — see request_booking_extension's own comment. Mapped to one friendly, honest message rather than a raw Postgres error. */
function friendlyExtensionError(err: { code?: string; message: string }): AdminApiError {
  if (err.code === '23P01') {
    return new AdminApiError(
      'This vehicle was just booked for an overlapping date by someone else. The extension could not be completed — no other vehicle was substituted.',
    )
  }
  return new AdminApiError(err.message)
}

export async function fetchExtensionsForBooking(bookingId: string): Promise<AdminExtensionWithDetails[]> {
  const { data, error } = await supabase
    .from('booking_extensions')
    .select(EXTENSION_SELECT)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  if (error) throw new AdminApiError(error.message)
  return (data ?? []) as unknown as AdminExtensionWithDetails[]
}

export async function fetchAllExtensions(): Promise<AdminExtensionWithDetails[]> {
  const { data, error } = await supabase
    .from('booking_extensions')
    .select(EXTENSION_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw new AdminApiError(error.message)
  return (data ?? []) as unknown as AdminExtensionWithDetails[]
}

/**
 * Phase 7 (direct Super Admin extension workflow) — every booking that is
 * genuinely being rented TODAY: status is confirmed or active AND today
 * falls inside the booking's own start/end window. A confirmed booking
 * that hasn't started yet, or one whose return date has already passed
 * but hasn't been marked completed, is deliberately excluded — this list
 * means "the customer has this car right now", not "any unfinished
 * booking" (the owner's own instruction: "Do not simply show every
 * historical booking"). Ordered by soonest return first — the ones an
 * owner is most likely to be asked to extend today.
 */
export async function fetchCurrentRentedCars(): Promise<AdminCurrentRentedCar[]> {
  const todayIso = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('bookings')
    .select('*, customers(*), vehicles(*, vehicle_categories(*), pricing(*)), payments(*)')
    .in('status', ['confirmed', 'active'])
    .lte('start_date', todayIso)
    .gte('end_date', todayIso)
    .order('end_date', { ascending: true })
  if (error) throw new AdminApiError(error.message)
  return (data ?? []) as unknown as AdminCurrentRentedCar[]
}

/**
 * Everything the "record an extension" form needs about the booking it's
 * extending, in one query: the booking itself, its exact vehicle (never
 * just the model), and that vehicle's CURRENT pricing rows (needed only
 * for the 'current_rate' policy — see src/lib/extensionPricing.ts).
 * Distinct from adminBookingsApi's fetchBookingById, which doesn't embed
 * vehicle pricing (that screen never needed it).
 */
export interface BookingForExtension {
  booking: BookingRow
  vehicle: VehicleRow
  vehiclePricing: PricingRow[]
}

export async function fetchBookingForExtension(bookingId: string): Promise<BookingForExtension | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, vehicles(*, pricing(*))')
    .eq('id', bookingId)
    .maybeSingle()
  if (error) throw new AdminApiError(error.message)
  if (!data) return null
  const { vehicles, ...booking } = data as unknown as BookingRow & { vehicles: (VehicleRow & { pricing: PricingRow[] }) | null }
  if (!vehicles) return null
  const { pricing, ...vehicle } = vehicles
  return { booking: booking as BookingRow, vehicle, vehiclePricing: pricing }
}

export async function fetchExtensionPricingSettings(): Promise<ExtensionPricingSettingsRecord> {
  const { data, error } = await supabase.from('extension_pricing_settings').select('*').eq('id', 1).single()
  if (error) throw new AdminApiError(error.message)
  return data
}

/** super_admin only at the database level (RLS) — a plain RLS-governed update, same convention as adminSettingsApi's other owner-only writes. */
export async function updateExtensionPricingSettings(input: {
  policy: ExtensionPricingPolicy
  customDailyRate: number | null
  customCurrency: string
}): Promise<void> {
  const { error } = await supabase
    .from('extension_pricing_settings')
    .update({
      policy: input.policy,
      custom_daily_rate: input.customDailyRate,
      custom_currency: input.customCurrency,
      updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
  if (error) throw new AdminApiError(error.message)
}

/**
 * Phase 7 (booking reassignment respec) — mirrors fetchExtensionPricingSettings/
 * updateExtensionPricingSettings exactly. See src/lib/extensionPenalty.ts.
 */
export async function fetchExtensionPenaltySettings(): Promise<ExtensionPenaltySettingsRecord> {
  const { data, error } = await supabase.from('extension_penalty_settings').select('*').eq('id', 1).single()
  if (error) throw new AdminApiError(error.message)
  return data
}

export async function updateExtensionPenaltySettings(input: {
  policy: ExtensionPenaltyPolicy
  fixedFeeAmount: number | null
  perDayAmount: number | null
  percentageRate: number | null
  currency: string
}): Promise<void> {
  const { error } = await supabase
    .from('extension_penalty_settings')
    .update({
      policy: input.policy,
      fixed_fee_amount: input.fixedFeeAmount,
      per_day_amount: input.perDayAmount,
      percentage_rate: input.percentageRate,
      currency: input.currency,
      updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
  if (error) throw new AdminApiError(error.message)
}

/** Read-only preview only — the real, race-safe check happens again inside requestBookingExtension itself. */
export async function checkVehicleAvailabilityForExtension(
  bookingId: string,
  requestedReturnDate: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_vehicle_availability_for_extension', {
    p_booking_id: bookingId,
    p_requested_return_date: requestedReturnDate,
  })
  if (error) throw friendlyExtensionError(error)
  return Boolean(data)
}

/** Every customer-submitted 'requested' row awaiting admin review — see fetchAllExtensions if the global history (all sources/statuses) is needed instead. */
export async function fetchPendingExtensionRequests(): Promise<AdminExtensionWithDetails[]> {
  const { data, error } = await supabase
    .from('booking_extensions')
    .select(EXTENSION_SELECT)
    .in('status', ['requested', 'conflict_unresolved'])
    .order('created_at', { ascending: true })
  if (error) throw new AdminApiError(error.message)
  return (data ?? []) as unknown as AdminExtensionWithDetails[]
}

export interface RequestExtensionInput {
  bookingId: string
  requestedReturnDate: string
  supportConfirmedBy: string | null
  supportConfirmationNote: string | null
  paymentMethod: 'cash' | 'online'
  amount: number
  currency: string
  pricingPolicyUsed: ExtensionPricingPolicy
  /** When reviewing a customer-submitted request rather than recording a fresh WhatsApp/admin one. */
  existingExtensionId?: string | null
  penaltyAmount?: number | null
  penaltyPolicyUsed?: ExtensionPenaltyPolicy | null
  /** The raw configured penalty value applied (percentage/per-day/fixed-fee — matching penaltyPolicyUsed), frozen onto booking_extensions.penalty_rate_used so a later Settings change never alters what this extension is shown to have used. See src/lib/extensionPenalty.ts's ExtensionPenaltyResult.rateUsed. */
  penaltyRateUsed?: number | null
}

export interface RequestExtensionResult {
  extensionId: string
  status: ExtensionStatus
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | null
  rejectionReason: string | null
  isLate: boolean
  penaltyAmount: number | null
  conflictBookingId: string | null
  replacementVehicleId: string | null
}

/**
 * Phase 9E: best-effort trigger for the deliver-extension-notifications
 * Edge Function, called right after any of this file's three
 * extension-processing RPCs succeeds. Never throws — an email problem
 * must never surface as a failure of the extension action the admin just
 * successfully completed. See deliver-extension-notifications/logic.ts
 * for why extensionId alone is enough: every other fact (which booking(s)
 * got a notification, who to email) is resolved server-side from the
 * unmodified booking_extensions/booking_notifications rows.
 */
async function triggerExtensionNotificationEmails(extensionId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('deliver-extension-notifications', {
      body: { extensionId },
    })
    if (error) {
      console.error('deliver-extension-notifications failed', error)
    }
  } catch (err) {
    console.error('deliver-extension-notifications failed', err)
  }
}

async function callRequestBookingExtension(input: RequestExtensionInput): Promise<RequestExtensionResult> {
  const { data, error } = await supabase.rpc('request_booking_extension', {
    p_booking_id: input.bookingId,
    p_requested_return_date: input.requestedReturnDate,
    p_support_confirmed_by: input.supportConfirmedBy,
    p_support_confirmation_note: input.supportConfirmationNote,
    p_payment_method: input.paymentMethod,
    p_amount: input.amount,
    p_currency: input.currency,
    p_pricing_policy_used: input.pricingPolicyUsed,
    p_existing_extension_id: input.existingExtensionId ?? null,
    p_penalty_amount: input.penaltyAmount ?? null,
    p_penalty_policy_used: input.penaltyPolicyUsed ?? null,
    p_penalty_rate_used: input.penaltyRateUsed ?? null,
  })
  if (error) throw friendlyExtensionError(error)
  const row = data?.[0] as
    | {
        extension_id: string
        status: ExtensionStatus
        payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | null
        rejection_reason: string | null
        is_late?: boolean
        penalty_amount?: number | null
        conflict_booking_id?: string | null
        replacement_vehicle_id?: string | null
      }
    | undefined
  if (!row) throw new AdminApiError('The extension could not be processed. Please try again.')

  // Fire-and-forget: a conflict/reassignment or a customer-review
  // approval can both produce a booking_notifications row here (see
  // deliverExtensionNotifications.ts) — awaited so the trigger reliably
  // fires before this function returns, but its own errors never surface.
  await triggerExtensionNotificationEmails(row.extension_id)

  return {
    extensionId: row.extension_id,
    status: row.status,
    paymentStatus: row.payment_status,
    rejectionReason: row.rejection_reason,
    isLate: row.is_late ?? false,
    penaltyAmount: row.penalty_amount ?? null,
    conflictBookingId: row.conflict_booking_id ?? null,
    replacementVehicleId: row.replacement_vehicle_id ?? null,
  }
}

/** WhatsApp/support channel: records a brand-new, already-confirmed extension request and processes it immediately. */
export async function requestBookingExtension(input: RequestExtensionInput): Promise<RequestExtensionResult> {
  return callRequestBookingExtension(input)
}

/**
 * Website self-service channel: an admin reviewing a customer-submitted
 * 'requested' (or 'conflict_unresolved') row. Runs the exact same engine as
 * requestBookingExtension — see request_booking_extension's own comment
 * ("one engine, two entry points") — just against an existing row instead
 * of inserting a new one.
 */
export async function processExtensionRequest(
  extensionId: string,
  input: Omit<RequestExtensionInput, 'existingExtensionId'>,
): Promise<RequestExtensionResult> {
  return callRequestBookingExtension({ ...input, existingExtensionId: extensionId })
}

/** Explicit admin rejection for a requested/conflict_unresolved/pending extension — see reject_extension_request's own comment for why this is now a distinct action. */
export async function rejectExtensionRequest(extensionId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('reject_extension_request', {
    p_extension_id: extensionId,
    p_rejection_reason: reason,
  })
  if (error) throw friendlyExtensionError(error)

  await triggerExtensionNotificationEmails(extensionId)
}

export async function confirmExtensionPayment(
  extensionId: string,
  outcome: 'paid' | 'failed',
  reference: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('confirm_booking_extension_payment', {
    p_extension_id: extensionId,
    p_outcome: outcome,
    p_reference: reference,
  })
  if (error) throw friendlyExtensionError(error)

  // A 'failed' outcome only updates payment_status — confirm_booking_extension_payment()
  // never writes a booking_notifications row for it (see the migration),
  // so there is nothing to deliver; only 'paid' can produce one (an
  // extension_approved row, and possibly a vehicle_reassigned row for a
  // different booking via resolve_extension_conflict()).
  if (outcome === 'paid') {
    await triggerExtensionNotificationEmails(extensionId)
  }
}
