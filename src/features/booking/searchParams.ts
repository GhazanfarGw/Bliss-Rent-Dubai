import type { SearchCriteria } from '@/types/domain'

export function criteriaToSearchParams(c: SearchCriteria): URLSearchParams {
  const params = new URLSearchParams({
    start: c.startDate,
    end: c.endDate,
    pickup: c.pickupLocationId,
    dropoff: c.dropoffLocationId,
  })
  // Optional display-only metadata — see SearchCriteria.pickupTime.
  if (c.pickupTime) params.set('ptime', c.pickupTime)
  return params
}

export function searchParamsToCriteria(params: URLSearchParams): Partial<SearchCriteria> {
  return {
    startDate: params.get('start') ?? undefined,
    endDate: params.get('end') ?? undefined,
    pickupLocationId: params.get('pickup') ?? undefined,
    dropoffLocationId: params.get('dropoff') ?? undefined,
    pickupTime: params.get('ptime') ?? undefined,
  }
}

export function isCompleteCriteria(
  c: Partial<SearchCriteria>,
): c is SearchCriteria {
  return Boolean(c.startDate && c.endDate && c.pickupLocationId && c.dropoffLocationId)
}
