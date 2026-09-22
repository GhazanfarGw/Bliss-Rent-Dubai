import { supabase } from '@/lib/supabaseClient'
import type { Location, VehicleSearchResult, VehicleWithDetails } from '@/types/domain'

const VEHICLE_SELECT =
  '*, vehicle_categories(id, name, description), vehicle_images(id, storage_path, is_primary, sort_order), pricing(id, term, list_price, client_price, currency)'

export class BookingApiError extends Error {}

/**
 * Bliss Rent is a UAE-wide business by design — `locations` has a `city`
 * column (free-text, not an enum: today it's Dubai and Abu Dhabi, but
 * adding Sharjah, Ajman, or any other city is a data row, never a schema
 * or code change) — see docs/ARCHITECTURE.md. Callers that need a single
 * city's pickup/drop-off points should filter the result by `.city`, same
 * as SearchWidget's Pickup City selector does. No component should
 * hardcode the current city list — it always comes from this query.
 */
export async function fetchLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('is_active', true)
    .order('city')
    .order('type')
    .order('name')

  if (error) throw new BookingApiError(error.message)
  return data
}

/**
 * Two-step, RLS-safe availability search:
 *  1. `available_vehicles` (a SECURITY DEFINER function) checks the
 *     private `bookings` table server-side and returns only the ids of
 *     vehicles with no overlapping non-cancelled booking for this range.
 *  2. A normal, RLS-respecting select re-fetches the WHOLE customer-facing
 *     fleet (every vehicle with status = 'available' in the admin Fleet
 *     sense) with public category/image/pricing data joined in.
 *
 * Every result is returned, not just the free ones — a vehicle with an
 * overlapping booking for these specific dates is still included, tagged
 * `isAvailable: false`, so customers can see the whole fleet and browse a
 * "Reserved" car's details or try different dates instead of it silently
 * vanishing from the list. No availability logic runs in this file or in
 * any component — `available_vehicles` in the database is the only source
 * of truth for what's actually bookable.
 */
export async function searchVehiclesWithAvailability(
  startDate: string,
  endDate: string,
): Promise<VehicleSearchResult[]> {
  const { data: available, error: rpcError } = await supabase.rpc('available_vehicles', {
    p_start_date: startDate,
    p_end_date: endDate,
  })
  if (rpcError) throw new BookingApiError(rpcError.message)
  const availableIds = new Set((available ?? []).map((v) => v.id))

  const { data, error } = await supabase
    .from('vehicles')
    .select(VEHICLE_SELECT)
    .eq('status', 'available')
    // Task 1 (2026-09-11 scoped update) — Reserved copies (Phase 14,
    // is_master_listing = false) are booking-specific clones and must
    // never surface publicly; only master listings are customer-facing.
    .eq('is_master_listing', true)
    .order('created_at', { ascending: false })

  if (error) throw new BookingApiError(error.message)
  return ((data ?? []) as unknown as VehicleWithDetails[]).map((v) => ({
    ...v,
    isAvailable: availableIds.has(v.id),
  }))
}

/**
 * A plain, read-only listing of vehicles for the homepage's Featured
 * Vehicles section — no date range, no availability RPC. Queries the same
 * already-public `vehicles`/`vehicle_categories`/`vehicle_images`/`pricing`
 * tables `fetchVehicleById` already reads (same RLS, same shape), just
 * without an id filter. This is not new backend functionality: no schema
 * change, no migration, no Edge Function — only a new client-side read.
 */
export async function fetchFeaturedVehicles(limit = 6): Promise<VehicleWithDetails[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select(VEHICLE_SELECT)
    .eq('status', 'available')
    // Task 1 — master listings only; see searchVehiclesWithAvailability above.
    .eq('is_master_listing', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new BookingApiError(error.message)
  return (data ?? []) as unknown as VehicleWithDetails[]
}

/**
 * All currently-available vehicles with no date-range filtering — the
 * Search page's default view before the customer has chosen pickup/
 * drop-off dates, so they can browse the fleet first instead of hitting a
 * "please choose dates" wall. Same public columns/RLS as
 * `fetchFeaturedVehicles`, just without the homepage's 6-car limit.
 */
export async function fetchAllAvailableVehicles(): Promise<VehicleWithDetails[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select(VEHICLE_SELECT)
    .eq('status', 'available')
    // Task 1 — master listings only; see searchVehiclesWithAvailability above.
    .eq('is_master_listing', true)
    .order('created_at', { ascending: false })

  if (error) throw new BookingApiError(error.message)
  return (data ?? []) as unknown as VehicleWithDetails[]
}

/**
 * `allowReservedCopy` (default false — Task 1's original rule): a
 * Reserved copy's id must never resolve on the public detail page
 * (VehicleDetailPage.tsx), even if guessed or linked directly.
 *
 * Checkout (useCheckoutContext.ts, every Customer/Driver/Summary/Payment
 * step) passes `true`: per the Phase 14 reserved-copy model
 * (supabase/migrations/20261001000000_phase14_reserved_vehicle_copies.sql),
 * every booking is created against a freshly-cloned, booking-specific
 * Reserved copy of the master listing — not the master listing's own row
 * — so resuming payment on almost any booking via Manage Booking's
 * "Continue to Payment" needs to resolve that exact Reserved-copy unit.
 * The bug this fixed was "We couldn't find that car" on resume, because
 * the booking's own `vehicle_id` was a Reserved copy the strict (default)
 * filter below silently excluded even though the vehicle really exists.
 *
 * That same migration also documents, but never implements, that
 * "Reserved copies deliberately do NOT get their own pricing/image rows
 * ... the application layer resolves both via `master_vehicle_id` when
 * set" — so a Reserved copy fetched here has empty `vehicle_images`/
 * `pricing` unless resolved. Done below rather than at each call site
 * (checkout's vehicle photo, any future pricing display) so every caller
 * gets a fully-populated vehicle either way.
 */
export async function fetchVehicleById(id: string, options: { allowReservedCopy?: boolean } = {}): Promise<VehicleWithDetails | null> {
  const base = supabase.from('vehicles').select(VEHICLE_SELECT).eq('id', id)
  const { data, error } = await (options.allowReservedCopy ? base : base.eq('is_master_listing', true)).maybeSingle()

  if (error) throw new BookingApiError(error.message)
  const vehicle = data as unknown as VehicleWithDetails | null
  if (!vehicle || vehicle.is_master_listing || !vehicle.master_vehicle_id) return vehicle

  const { data: master, error: masterError } = await supabase
    .from('vehicles')
    .select('vehicle_images(id, storage_path, is_primary, sort_order), pricing(id, term, list_price, client_price, currency)')
    .eq('id', vehicle.master_vehicle_id)
    .maybeSingle()
  if (masterError) throw new BookingApiError(masterError.message)

  const masterDetails = master as unknown as Pick<VehicleWithDetails, 'vehicle_images' | 'pricing'> | null
  return { ...vehicle, vehicle_images: masterDetails?.vehicle_images ?? [], pricing: masterDetails?.pricing ?? [] }
}

/** Used on the vehicle detail page to recheck a specific vehicle against the requested dates. */
export async function isVehicleAvailable(
  vehicleId: string,
  startDate: string,
  endDate: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('available_vehicles', {
    p_start_date: startDate,
    p_end_date: endDate,
  })
  if (error) throw new BookingApiError(error.message)
  return (data ?? []).some((v) => v.id === vehicleId)
}
