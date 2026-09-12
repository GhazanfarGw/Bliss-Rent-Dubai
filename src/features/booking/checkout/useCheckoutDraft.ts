import { useCallback, useEffect, useState } from 'react'
import type { CheckoutDraft, CustomerDraft, DriverDraft, SearchCriteria } from '@/types/domain'
import { EMPTY_CUSTOMER_DRAFT, EMPTY_DRIVER_DRAFT } from '@/types/domain'

/**
 * Persists the in-progress checkout (customer + driver form data) to
 * sessionStorage, keyed per vehicle, so a page refresh or the browser's
 * back/forward buttons don't lose what the customer already typed. This
 * is a guest checkout (no auth session — see the Phase 2 migration
 * comment for why), so there is no server-side place to hold draft state
 * between steps; sessionStorage is the right scope for it — per-tab,
 * cleared when the tab closes, never sent anywhere.
 *
 * Wrapped in try/catch throughout: sessionStorage can throw in some
 * browser contexts (private browsing, storage disabled), and losing the
 * draft is a minor inconvenience, not a reason to crash the checkout.
 */
function storageKey(vehicleId: string): string {
  return `dxb-checkout:${vehicleId}`
}

function readDraft(vehicleId: string): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(storageKey(vehicleId))
    if (!raw) return null
    return JSON.parse(raw) as CheckoutDraft
  } catch {
    return null
  }
}

function writeDraft(draft: CheckoutDraft) {
  try {
    sessionStorage.setItem(storageKey(draft.vehicleId), JSON.stringify(draft))
  } catch {
    // Best-effort only — see module comment.
  }
}

export function useCheckoutDraft(vehicleId: string, criteria: SearchCriteria) {
  const [draft, setDraft] = useState<CheckoutDraft>(() => {
    const existing = readDraft(vehicleId)
    if (existing) return existing
    return { vehicleId, criteria, customer: EMPTY_CUSTOMER_DRAFT, driver: EMPTY_DRIVER_DRAFT }
  })

  // Keep the persisted criteria in sync if the customer navigated back
  // and changed dates/locations via the URL.
  useEffect(() => {
    setDraft((prev) => {
      const next = { ...prev, criteria }
      writeDraft(next)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria.startDate, criteria.endDate, criteria.pickupLocationId, criteria.dropoffLocationId])

  const updateCustomer = useCallback((patch: Partial<CustomerDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, customer: { ...prev.customer, ...patch } }
      writeDraft(next)
      return next
    })
  }, [])

  const updateDriver = useCallback((patch: Partial<DriverDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, driver: { ...prev.driver, ...patch } }
      writeDraft(next)
      return next
    })
  }, [])

  return { draft, updateCustomer, updateDriver }
}
