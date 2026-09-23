import { supabase } from '@/lib/supabaseClient'
import { AdminApiError } from '@/features/admin/adminApi'
import type { AdminVehicleWithDetails, VehicleDraft } from '@/types/domain'
import type { Database } from '@/types/database'

type CategoryRow = Database['public']['Tables']['vehicle_categories']['Row']
type VehicleRow = Database['public']['Tables']['vehicles']['Row']

const VEHICLE_SELECT = '*, vehicle_categories(*), vehicle_images(*), pricing(*)'

export async function fetchCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase.from('vehicle_categories').select('*').order('name')
  if (error) throw new AdminApiError(error.message)
  return data ?? []
}

/**
 * Fetches vehicles plus their CURRENT operational status. The status
 * comes from the vehicle_operational_status view (Phase 3 migration) —
 * fetched separately and merged here because it's not FK-embeddable via
 * PostgREST, not because the classification logic lives in this file
 * (it doesn't; the view is the single source of truth for that).
 */

export async function fetchVehicles(): Promise<AdminVehicleWithDetails[]> {
  const [vehiclesRes, statusRes] = await Promise.all([
    supabase.from('vehicles').select(VEHICLE_SELECT).order('make').order('model'),
    supabase.from('vehicle_operational_status').select('*'),
  ])
  if (vehiclesRes.error) throw new AdminApiError(vehiclesRes.error.message)
  if (statusRes.error) throw new AdminApiError(statusRes.error.message)

  const statusByVehicle = new Map((statusRes.data ?? []).map((s) => [s.vehicle_id, s.operational_status]))

  return ((vehiclesRes.data ?? []) as unknown as Omit<AdminVehicleWithDetails, 'operational_status'>[]).map((v) => ({
    ...v,
    operational_status: statusByVehicle.get(v.id) ?? 'available',
  }))
}

export async function fetchVehicleById(id: string): Promise<AdminVehicleWithDetails | null> {
  const [vehicleRes, statusRes] = await Promise.all([
    supabase.from('vehicles').select(VEHICLE_SELECT).eq('id', id).maybeSingle(),
    supabase.from('vehicle_operational_status').select('*').eq('vehicle_id', id).maybeSingle(),
  ])
  if (vehicleRes.error) throw new AdminApiError(vehicleRes.error.message)
  if (!vehicleRes.data) return null
  if (statusRes.error) throw new AdminApiError(statusRes.error.message)

  return {
    ...(vehicleRes.data as unknown as Omit<AdminVehicleWithDetails, 'operational_status'>),
    operational_status: statusRes.data?.operational_status ?? 'available',
  }
}

/** A blank form field means "not entered": stored as NULL, never as an empty string or 0. */
const textOrNull = (value: string): string | null => value.trim() || null
const numberOrNull = (value: string): number | null => (value.trim() === '' ? null : Number(value))

function draftToRow(draft: VehicleDraft): Omit<VehicleRow, 'id' | 'created_at'> {
  return {
    category_id: draft.categoryId,
    make: draft.make.trim(),
    model: draft.model.trim(),
    model_year: Number(draft.modelYear),
    transmission: draft.transmission.trim() || 'automatic',
    seats: Number(draft.seats),
    plate_number: draft.plateNumber.trim(),
    status: draft.status,
    engine: textOrNull(draft.engine),
    horsepower: numberOrNull(draft.horsepower),
    torque_nm: numberOrNull(draft.torqueNm),
    top_speed_kmh: numberOrNull(draft.topSpeedKmh),
    acceleration_0_100: numberOrNull(draft.acceleration0100),
    fuel_type: textOrNull(draft.fuelType),
    fuel_consumption_l100km: numberOrNull(draft.fuelConsumptionL100km),
    drivetrain: textOrNull(draft.drivetrain),
    doors: numberOrNull(draft.doors),
    origin_country: textOrNull(draft.originCountry),
    about: textOrNull(draft.about),
    about_ar: textOrNull(draft.aboutAr),
    // Phase 14 — every vehicle created through this Add/Edit Vehicle admin
    // UI is a real physical car with its own real plate, i.e. a master
    // listing (is_master_listing = true, the column's own DB default and
    // the correct value for every vehicle that isn't a booking-specific
    // Reserved copy — Reserved copies are only ever created by
    // create_booking() itself, never through this form).
    is_master_listing: true,
    master_vehicle_id: null,
  }
}

/** Plain RLS-governed insert — "admins manage vehicles" already covers this; the vehicles_audit trigger logs it automatically. */
export async function createVehicle(draft: VehicleDraft): Promise<string> {
  const { data, error } = await supabase.from('vehicles').insert(draftToRow(draft)).select('id').single()
  if (error) throw new AdminApiError(error.message)
  return data.id
}

export async function updateVehicle(id: string, draft: VehicleDraft): Promise<void> {
  const { error } = await supabase.from('vehicles').update(draftToRow(draft)).eq('id', id)
  if (error) throw new AdminApiError(error.message)
}

export async function updateVehicleStatus(id: string, status: VehicleRow['status']): Promise<void> {
  const { error } = await supabase.from('vehicles').update({ status }).eq('id', id)
  if (error) throw new AdminApiError(error.message)
}

/** Uploads into the public 'vehicle-images' bucket (admins-write RLS policy from Phase 0) and records the row. */
export async function uploadVehicleImage(vehicleId: string, file: File, isPrimary: boolean): Promise<void> {
  const path = `${vehicleId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
  const { error: uploadError } = await supabase.storage.from('vehicle-images').upload(path, file, { upsert: false })
  if (uploadError) throw new AdminApiError(uploadError.message)

  const { error: insertError } = await supabase.from('vehicle_images').insert({
    vehicle_id: vehicleId,
    storage_path: path,
    is_primary: isPrimary,
  })
  if (insertError) throw new AdminApiError(insertError.message)
}

export async function setPrimaryImage(vehicleId: string, imageId: string): Promise<void> {
  const { error: clearError } = await supabase.from('vehicle_images').update({ is_primary: false }).eq('vehicle_id', vehicleId)
  if (clearError) throw new AdminApiError(clearError.message)
  const { error: setError } = await supabase.from('vehicle_images').update({ is_primary: true }).eq('id', imageId)
  if (setError) throw new AdminApiError(setError.message)
}

export async function deleteVehicleImage(imageId: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from('vehicle-images').remove([storagePath])
  if (storageError) throw new AdminApiError(storageError.message)
  const { error: rowError } = await supabase.from('vehicle_images').delete().eq('id', imageId)
  if (rowError) throw new AdminApiError(rowError.message)
}

/**
 * Removes the vehicle's photos from storage (vehicle_images/pricing rows
 * cascade from the DB delete itself) then deletes the vehicle row. Blocked
 * by "on delete restrict" if any booking still references this vehicle
 * directly — the resulting Postgres error message is surfaced as-is, same
 * as every other admin*Api.ts call site.
 */
export async function deleteVehicle(id: string, imageStoragePaths: string[]): Promise<void> {
  if (imageStoragePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from('vehicle-images').remove(imageStoragePaths)
    if (storageError) throw new AdminApiError(storageError.message)
  }
  const { error } = await supabase.from('vehicles').delete().eq('id', id)
  if (error) throw new AdminApiError(error.message)
}
