import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchLocations, fetchVehicleById, BookingApiError } from '@/features/booking/api'
import { isCompleteCriteria, searchParamsToCriteria } from '@/features/booking/searchParams'
import { validateDateRange } from '@/lib/dateRange'
import { useCheckoutDraft } from '@/features/booking/checkout/useCheckoutDraft'
import type { Location, SearchCriteria, VehicleWithDetails } from '@/types/domain'

export type CheckoutLoadState = 'loading' | 'error' | 'not_found' | 'missing_criteria' | 'ready'

const EMPTY_CRITERIA: SearchCriteria = { startDate: '', endDate: '', pickupLocationId: '', dropoffLocationId: '' }

/**
 * Shared loader for every checkout step (Customer/Driver/Summary/
 * Payment): resolves the vehicle + Dubai locations + the dates/locations
 * carried in the URL (same query param convention as the search results
 * page), and wires up the sessionStorage-backed draft. One hook, reused
 * by every step, so "what does this page need before it can render"
 * logic isn't duplicated four times.
 */
export function useCheckoutContext(vehicleId: string | undefined) {
  const [searchParams] = useSearchParams()
  const criteriaPartial = searchParamsToCriteria(searchParams)
  const criteriaValid =
    isCompleteCriteria(criteriaPartial) && validateDateRange(criteriaPartial.startDate, criteriaPartial.endDate).valid
  const criteria = criteriaValid ? (criteriaPartial as SearchCriteria) : null

  const [vehicle, setVehicle] = useState<VehicleWithDetails | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [loadState, setLoadState] = useState<CheckoutLoadState>(criteria ? 'loading' : 'missing_criteria')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!vehicleId || !criteria) return
    let cancelled = false
    setLoadState('loading')
    Promise.all([fetchVehicleById(vehicleId), fetchLocations()])
      .then(([v, locs]) => {
        if (cancelled) return
        if (!v) {
          setLoadState('not_found')
          return
        }
        setVehicle(v)
        setLocations(locs)
        setLoadState('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setErrorMessage(err instanceof BookingApiError || err instanceof Error ? err.message : 'Something went wrong.')
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, criteria?.startDate, criteria?.endDate, criteria?.pickupLocationId, criteria?.dropoffLocationId])

  const { draft, updateCustomer, updateDriver } = useCheckoutDraft(vehicleId ?? '', criteria ?? EMPTY_CRITERIA)

  const pickup = locations.find((l) => l.id === criteria?.pickupLocationId) ?? null
  const dropoff = locations.find((l) => l.id === criteria?.dropoffLocationId) ?? null

  return { loadState, vehicle, locations, criteria, pickup, dropoff, errorMessage, draft, updateCustomer, updateDriver }
}
