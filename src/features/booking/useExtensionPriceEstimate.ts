import { useEffect, useMemo, useState } from 'react'
import { fetchExtensionEstimateConfig, fetchVehiclePricingRows } from '@/features/booking/extensionEstimateApi'
import { computeExtensionAmount, ExtensionPricingError, type ExtensionPricingSettings } from '@/lib/extensionPricing'
import { computeExtensionPenalty, ExtensionPenaltyError, type ExtensionPenaltySettings } from '@/lib/extensionPenalty'
import type { Database } from '@/types/database'

type PricingRow = Database['public']['Tables']['pricing']['Row']

export interface ExtensionPriceEstimateArgs {
  vehicleId: string
  originalStartDate: string
  originalEndDate: string
  originalTotalPrice: number
  originalCurrency: string
  /** The day count the customer currently has selected/typed. Null while nothing valid is chosen yet. */
  extensionDays: number | null
}

export interface ExtensionPriceEstimate {
  status: 'loading' | 'ready' | 'unavailable'
  isLate: boolean
  addedAmount: number | null
  penaltyAmount: number | null
  newTotal: number | null
  currency: string | null
}

/** Mirrors the server's own lateness check (`current_date > v_booking.end_date` in request_booking_extension/confirm_booking_extension_payment) — purely for the PREVIEW; the actual is_late flag used to price and record the extension is always decided server-side. */
function isPastDate(dateIso: string, today: Date = new Date()): boolean {
  const d = new Date(dateIso + 'T00:00:00')
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return todayMidnight > d
}

/**
 * Live "how much will this extension add, and what's my new total"
 * preview, computed entirely client-side from data that is either already
 * public (the vehicle's own pricing rows) or now exposed narrowly for
 * exactly this purpose (get_extension_estimate_config() — see
 * extensionEstimateApi.ts's own header). Recomputing on every keystroke
 * needs no network round trip: config + pricing rows are fetched once per
 * vehicle, then computeExtensionAmount()/computeExtensionPenalty() (the
 * SAME pure functions the backend's own request/confirm functions were
 * modeled on) run instantly against whichever day count is selected.
 *
 * Never blocks submission: if the policy isn't configured, the vehicle
 * has no daily rate, or anything else about the estimate can't be
 * computed, this just reports `status: 'unavailable'` — the extend form
 * still works exactly as it did before this feature existed, since the
 * server remains the actual pricing authority.
 */
export function useExtensionPriceEstimate(args: ExtensionPriceEstimateArgs): ExtensionPriceEstimate {
  const { vehicleId, originalStartDate, originalEndDate, originalTotalPrice, originalCurrency, extensionDays } = args

  const [config, setConfig] = useState<{ pricing: ExtensionPricingSettings; penalty: ExtensionPenaltySettings } | null>(null)
  const [pricingRows, setPricingRows] = useState<PricingRow[] | null>(null)
  const [fetchFailed, setFetchFailed] = useState(false)

  // Deliberately does NOT reset config/pricingRows/fetchFailed to null
  // synchronously at the top of this effect (that pattern trips the
  // set-state-in-effect lint and forces an extra render for no benefit
  // here): both call sites mount a fresh component per booking
  // (VerifiedResult / ExtendRentalSection), so `vehicleId` never actually
  // changes within one of these hook instances' lifetime — this effect's
  // job is just the one-time fetch on mount, resolved into state exactly
  // once.
  useEffect(() => {
    let cancelled = false

    void Promise.all([fetchExtensionEstimateConfig(), fetchVehiclePricingRows(vehicleId)])
      .then(([cfg, rows]) => {
        if (cancelled) return
        setConfig(cfg)
        setPricingRows(rows)
      })
      .catch(() => {
        if (cancelled) return
        setFetchFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [vehicleId])

  return useMemo<ExtensionPriceEstimate>(() => {
    const isLate = isPastDate(originalEndDate)

    if (fetchFailed) return { status: 'unavailable', isLate, addedAmount: null, penaltyAmount: null, newTotal: null, currency: null }
    if (!config || !pricingRows) return { status: 'loading', isLate, addedAmount: null, penaltyAmount: null, newTotal: null, currency: null }
    if (!extensionDays || extensionDays < 1 || extensionDays > 30) {
      return { status: 'unavailable', isLate, addedAmount: null, penaltyAmount: null, newTotal: null, currency: null }
    }

    try {
      const priced = computeExtensionAmount({
        settings: config.pricing,
        extensionDays,
        originalBooking: {
          startDate: originalStartDate,
          endDate: originalEndDate,
          totalPrice: originalTotalPrice,
          currency: originalCurrency,
        },
        currentVehiclePricing: pricingRows,
      })

      let penaltyAmount: number | null = null
      if (isLate) {
        const penalty = computeExtensionPenalty({
          settings: config.penalty,
          isLate: true,
          extensionDays,
          extensionAmount: priced.amount,
        })
        penaltyAmount = penalty?.amount ?? null
      }

      const newTotal = originalTotalPrice + priced.amount + (penaltyAmount ?? 0)
      return { status: 'ready', isLate, addedAmount: priced.amount, penaltyAmount, newTotal, currency: priced.currency }
    } catch (err) {
      if (err instanceof ExtensionPricingError || err instanceof ExtensionPenaltyError) {
        return { status: 'unavailable', isLate, addedAmount: null, penaltyAmount: null, newTotal: null, currency: null }
      }
      throw err
    }
  }, [config, pricingRows, fetchFailed, extensionDays, originalStartDate, originalEndDate, originalTotalPrice, originalCurrency])
}
