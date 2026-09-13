import { useEffect, useState } from 'react'
import { fetchAllAvailableVehicles, fetchLocations } from '@/features/booking/api'

/**
 * Live counts pulled from the same real fleet/locations queries used
 * across the site (Hero's trust row, AboutPage's "Bliss Rent today"
 * stats, the homepage category grid) — never a hand-typed number.
 * `null` until the fetch resolves, and stays `null` on failure; callers
 * must render nothing (or hide the section) rather than ever showing a
 * fake/placeholder number. Extracted from Hero.tsx/AboutPage.tsx, which
 * each used to run this exact same two-call fetch independently.
 */
export interface FleetStats {
  vehicleCount: number
  categoryNames: string[]
  categoryCount: number
  cityNames: string[]
  cityCount: number
}

export function useFleetStats(): FleetStats | null {
  const [stats, setStats] = useState<FleetStats | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchAllAvailableVehicles(), fetchLocations()])
      .then(([vehicles, locations]) => {
        if (cancelled) return
        const categoryNames = Array.from(
          new Set(vehicles.map((v) => v.vehicle_categories?.name).filter((name): name is string => Boolean(name))),
        ).sort()
        const cityNames = Array.from(new Set(locations.map((l) => l.city))).sort()
        setStats({
          vehicleCount: vehicles.length,
          categoryNames,
          categoryCount: categoryNames.length,
          cityNames,
          cityCount: cityNames.length,
        })
      })
      .catch(() => {
        // Best-effort only, same as every consumer before this extraction —
        // the stats simply stay null and callers render nothing.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return stats
}
