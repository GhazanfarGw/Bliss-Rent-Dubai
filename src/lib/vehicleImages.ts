import type { VehicleWithDetails } from '@/types/domain'

/** Primary image if flagged, else the lowest sort_order, else null (no fabricated fallback photo). */
export function primaryImage(vehicle: VehicleWithDetails) {
  if (vehicle.vehicle_images.length === 0) return null
  const primary = vehicle.vehicle_images.find((img) => img.is_primary)
  if (primary) return primary
  return [...vehicle.vehicle_images].sort((a, b) => a.sort_order - b.sort_order)[0]
}
