import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock } from 'lucide-react'
import {
  fetchCurrentRentedCars,
  fetchExtensionPricingSettings,
  fetchExtensionPenaltySettings,
  checkVehicleAvailabilityForExtension,
  requestBookingExtension,
} from '@/features/admin/extensions/adminExtensionsApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { useAdminAuth } from '@/features/admin/AdminAuthContext'
import { AdminStatusBadge } from '@/features/admin/shared/AdminStatusBadge'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import { formatBookingReference } from '@/lib/bookingReference'
import { computeExtensionAmount, extensionDaysBetween, ExtensionPricingError } from '@/lib/extensionPricing'
import { computeExtensionPenalty, ExtensionPenaltyError } from '@/lib/extensionPenalty'
import type { AdminCurrentRentedCar } from '@/types/domain'
import type { ExtensionPricingSettingsRecord, ExtensionPenaltySettingsRecord } from '@/types/domain'

type CarsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; cars: AdminCurrentRentedCar[] }

type SettingsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; pricing: ExtensionPricingSettingsRecord; penalty: ExtensionPenaltySettingsRecord }

type AvailabilityState = { status: 'idle' } | { status: 'checking' } | { status: 'done'; available: boolean } | { status: 'error'; message: string }

type Step = 'form' | 'confirm'

/** Today, as a plain 'YYYY-MM-DD' — matches how every date column in this table is stored (no time component), so string comparison against start_date/end_date is safe. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function isPastDate(dateIso: string): boolean {
  return todayIso() > dateIso
}

/** Adds N whole days to a plain 'YYYY-MM-DD' date, anchored at UTC midnight so this never drifts a day depending on the browser's local timezone. */
function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Phase 7 (direct Super Admin extension workflow, 2026-08-29) — the
 * "Current Rented Cars" section on the Extensions admin page. Lets an
 * owner/admin extend a customer's currently-rented vehicle directly, from
 * inside the dashboard, without waiting for the customer to submit a
 * website request or call in over WhatsApp first.
 *
 * This is deliberately a THIRD entry point into the exact same engine
 * RentalExtensionsSection already uses (requestBookingExtension with no
 * existingExtensionId — the "fresh admin/WhatsApp-channel" branch of
 * request_booking_extension's own "one engine, two [now three] entry
 * points" design) — see that function's comment in
 * supabase/migrations/20260903000000_phase7_booking_reassignment.sql.
 * Nothing here bypasses or duplicates: pricing (computeExtensionAmount),
 * penalty (computeExtensionPenalty), availability
 * (checkVehicleAvailabilityForExtension), the 1-30 day + required-field
 * validation, and the cash/Super-Admin-only rule are the SAME functions
 * and the SAME database gate every other extension channel already uses.
 *
 * Super Admin only (2026-08-29 direction): the whole panel — not just the
 * cash option — is restricted to super_admin. Staff keep the existing
 * customer-request/review workflow and online-extension capability
 * exactly as before; they just never see "Current Rented Cars" or an
 * "Extend Rental" button at all. This is UI-level convenience only — the
 * database's own is_super_admin() check inside request_booking_extension
 * (unchanged) is still what actually blocks a non-super-admin cash
 * extension; nothing here is the real security boundary.
 */
export function CurrentRentedCarsSection({ onExtended }: { onExtended: () => void }) {
  const { t } = useTranslation()
  const { adminProfile } = useAdminAuth()
  const isSuperAdmin = adminProfile?.role === 'super_admin'

  const [carsState, setCarsState] = useState<CarsState>({ status: 'loading' })
  const [settingsState, setSettingsState] = useState<SettingsState>({ status: 'loading' })
  const [selected, setSelected] = useState<AdminCurrentRentedCar | null>(null)
  const [step, setStep] = useState<Step>('form')

  const [extensionDaysInput, setExtensionDaysInput] = useState('')
  const [supportConfirmedBy, setSupportConfirmedBy] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | ''>('')
  const [availability, setAvailability] = useState<AvailabilityState>({ status: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function loadCars() {
    setCarsState({ status: 'loading' })
    try {
      const cars = await fetchCurrentRentedCars()
      setCarsState({ status: 'loaded', cars })
    } catch (err) {
      setCarsState({
        status: 'error',
        message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'),
      })
    }
  }

  async function loadSettings() {
    setSettingsState({ status: 'loading' })
    try {
      const [pricing, penalty] = await Promise.all([fetchExtensionPricingSettings(), fetchExtensionPenaltySettings()])
      setSettingsState({ status: 'loaded', pricing, penalty })
    } catch (err) {
      setSettingsState({
        status: 'error',
        message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'),
      })
    }
  }

  useEffect(() => {
    // Super Admin only — a staff account never triggers these fetches at
    // all (not just "hides the result"), since this whole panel is not
    // theirs to use.
    if (!isSuperAdmin) return
    void loadCars()
    void loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin])

  function openPanel(car: AdminCurrentRentedCar) {
    setSelected(car)
    setStep('form')
    setExtensionDaysInput('')
    setSupportConfirmedBy(adminProfile?.full_name ?? '')
    setPaymentMethod('')
    setAvailability({ status: 'idle' })
    setSubmitError(null)
  }

  function closePanel() {
    setSelected(null)
  }

  const extensionDays = extensionDaysInput ? Number.parseInt(extensionDaysInput, 10) : null
  const daysValid = extensionDays !== null && Number.isFinite(extensionDays) && extensionDays >= 1 && extensionDays <= 30
  const newReturnDate = selected && daysValid ? addDaysIso(selected.end_date, extensionDays!) : null
  const isLate = selected ? isPastDate(selected.end_date) : false

  // Live availability preview for the exact vehicle, debounced — the same
  // read-only RPC every other extension channel previews with, and the
  // same one request_booking_extension re-checks for real on submit.
  useEffect(() => {
    if (!selected || !newReturnDate) {
      setAvailability({ status: 'idle' })
      return
    }
    let cancelled = false
    setAvailability({ status: 'checking' })
    const timer = setTimeout(() => {
      checkVehicleAvailabilityForExtension(selected.id, newReturnDate)
        .then((available) => {
          if (!cancelled) setAvailability({ status: 'done', available })
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setAvailability({
            status: 'error',
            message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'),
          })
        })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, newReturnDate])

  const pricingPreview = (() => {
    if (settingsState.status !== 'loaded' || !selected || !daysValid || !newReturnDate) return null
    try {
      const result = computeExtensionAmount({
        settings: {
          policy: settingsState.pricing.policy,
          customDailyRate: settingsState.pricing.custom_daily_rate,
          customCurrency: settingsState.pricing.custom_currency,
        },
        extensionDays: extensionDaysBetween(selected.end_date, newReturnDate),
        originalBooking: {
          startDate: selected.start_date,
          endDate: selected.end_date,
          totalPrice: selected.total_price,
          currency: selected.currency,
        },
        currentVehiclePricing: selected.vehicles?.pricing ?? [],
      })
      return { ok: true as const, ...result }
    } catch (err) {
      return { ok: false as const, message: err instanceof ExtensionPricingError ? err.message : t('admin.errorGeneric') }
    }
  })()

  const penaltyPreview = (() => {
    if (settingsState.status !== 'loaded' || !daysValid) return null
    try {
      const result = computeExtensionPenalty({
        settings: {
          policy: settingsState.penalty.policy,
          fixedFeeAmount: settingsState.penalty.fixed_fee_amount,
          perDayAmount: settingsState.penalty.per_day_amount,
          percentageRate: settingsState.penalty.percentage_rate,
          currency: settingsState.penalty.currency,
        },
        isLate,
        extensionDays: extensionDays!,
        extensionAmount: pricingPreview?.ok ? pricingPreview.amount : 0,
      })
      return { ok: true as const, result }
    } catch (err) {
      return { ok: false as const, message: err instanceof ExtensionPenaltyError ? err.message : t('admin.errorGeneric') }
    }
  })()

  const totalAmount = pricingPreview?.ok ? pricingPreview.amount + (isLate && penaltyPreview?.ok ? penaltyPreview.result?.amount ?? 0 : 0) : null

  const canReview =
    daysValid &&
    !!supportConfirmedBy.trim() &&
    !!paymentMethod &&
    !(paymentMethod === 'cash' && !isSuperAdmin) &&
    pricingPreview?.ok &&
    (!isLate || penaltyPreview?.ok)

  async function handleConfirm() {
    if (!selected || !newReturnDate || !pricingPreview?.ok || !paymentMethod) return
    if (paymentMethod === 'cash' && !isSuperAdmin) {
      // Defense in depth only — the database rejects this regardless (see
      // request_booking_extension's is_super_admin() check). The payment
      // method control below already hides "cash" for a non-super_admin.
      setSubmitError(t('admin.extensions.form.cashSuperAdminOnly'))
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await requestBookingExtension({
        bookingId: selected.id,
        requestedReturnDate: newReturnDate,
        supportConfirmedBy: supportConfirmedBy.trim(),
        supportConfirmationNote: 'Recorded directly from Extensions → Current Rented Cars.',
        paymentMethod,
        amount: pricingPreview.amount,
        currency: pricingPreview.currency,
        pricingPolicyUsed: pricingPreview.policy,
        penaltyAmount: isLate && penaltyPreview?.ok ? penaltyPreview.result?.amount ?? null : null,
        penaltyPolicyUsed: isLate && penaltyPreview?.ok ? penaltyPreview.result?.policy ?? null : null,
        penaltyRateUsed: isLate && penaltyPreview?.ok ? penaltyPreview.result?.rateUsed ?? null : null,
      })
      setSuccessMessage(
        t('admin.extensions.currentRentedCars.panel.successBody', {
          reference: formatBookingReference(selected.id),
          date: result.status === 'pending' ? newReturnDate : newReturnDate,
        }),
      )
      closePanel()
      await loadCars()
      onExtended()
    } catch (err) {
      setSubmitError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  // Super Admin only — staff never see this section or an Extend Rental
  // button at all (not just the cash option within it). This is a UI
  // convenience only: the database's is_super_admin() check inside
  // request_booking_extension is the actual, unbypassable gate for cash;
  // this early return just keeps staff from being shown a workflow that
  // isn't theirs to use.
  if (!isSuperAdmin) return null

  return (
    <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
      <h2 className="text-sm font-semibold text-brand-navy">{t('admin.extensions.currentRentedCars.title')}</h2>
      <p className="mt-1 text-xs text-text-muted">{t('admin.extensions.currentRentedCars.subtitle')}</p>

      {successMessage && (
        <div className="mt-4 rounded-xl border border-success/25 bg-success-bg p-3 text-sm text-success">
          <p className="font-semibold">{t('admin.extensions.currentRentedCars.panel.successTitle')}</p>
          <p className="mt-1">{successMessage}</p>
          <button type="button" onClick={() => setSuccessMessage(null)} className="mt-2 text-xs font-semibold underline">
            {t('admin.extensions.result.dismiss')}
          </button>
        </div>
      )}

      {carsState.status === 'loading' && (
        <div className="flex justify-center py-6">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      {carsState.status === 'error' && <StateMessage tone="error" title={t('admin.errorGeneric')} body={carsState.message} />}

      {carsState.status === 'loaded' && carsState.cars.length === 0 && (
        <div className="mt-4">
          <StateMessage
            tone="neutral"
            title={t('admin.extensions.currentRentedCars.emptyTitle')}
            body={t('admin.extensions.currentRentedCars.emptyBody')}
          />
        </div>
      )}

      {carsState.status === 'loaded' && carsState.cars.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-brand-navy/10 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="py-2 pe-3 text-start">{t('admin.extensions.currentRentedCars.columns.customer')}</th>
                <th className="py-2 pe-3 text-start">{t('admin.extensions.currentRentedCars.columns.booking')}</th>
                <th className="py-2 pe-3 text-start">{t('admin.extensions.currentRentedCars.columns.vehicle')}</th>
                <th className="py-2 pe-3 text-start">{t('admin.extensions.currentRentedCars.columns.plate')}</th>
                <th className="py-2 pe-3 text-start">{t('admin.extensions.currentRentedCars.columns.currentReturn')}</th>
                <th className="py-2 pe-3 text-start">{t('admin.extensions.currentRentedCars.columns.status')}</th>
                <th className="py-2 pe-3 text-start">{t('admin.extensions.currentRentedCars.columns.paymentStatus')}</th>
                <th className="py-2 pe-3 text-start">{t('admin.extensions.currentRentedCars.columns.days')}</th>
                <th className="py-2 ps-3 text-end" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-navy/5">
              {carsState.cars.map((car) => {
                const days = extensionDaysBetween(car.start_date, car.end_date)
                return (
                  <tr key={car.id}>
                    <td className="py-3 pe-3 font-medium text-brand-navy">{car.customers?.full_name ?? '—'}</td>
                    <td className="py-3 pe-3 font-mono text-xs">{formatBookingReference(car.id)}</td>
                    <td className="py-3 pe-3 text-xs">{car.vehicles ? `${car.vehicles.make} ${car.vehicles.model}` : '—'}</td>
                    <td className="py-3 pe-3 text-xs">{car.vehicles?.plate_number ?? '—'}</td>
                    <td className="py-3 pe-3 text-xs">{car.end_date}</td>
                    <td className="py-3 pe-3">
                      <AdminStatusBadge status={car.status} />
                    </td>
                    <td className="py-3 pe-3">
                      <AdminStatusBadge status={car.payments[0]?.status ?? 'pending'} />
                    </td>
                    <td className="py-3 pe-3">{days}</td>
                    <td className="py-3 ps-3 text-end">
                      <button
                        type="button"
                        disabled={!car.vehicles}
                        onClick={() => openPanel(car)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-gold-light disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('admin.extensions.currentRentedCars.extendButton')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-navy-dark/50" onClick={submitting ? undefined : closePanel} />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            {step === 'form' && (
              <>
                <h3 className="text-base font-semibold text-brand-navy">{t('admin.extensions.currentRentedCars.panel.title')}</h3>

                <div className="mt-3 rounded-xl border border-brand-navy/10 bg-brand-lavender/10 p-3 text-sm">
                  <p className="font-semibold text-brand-navy">{selected.customers?.full_name ?? '—'}</p>
                  <p className="mt-1 text-xs text-brand-navy/80">
                    {formatBookingReference(selected.id)} · {selected.vehicles?.make} {selected.vehicles?.model} · {selected.vehicles?.plate_number}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {t('admin.extensions.currentRentedCars.panel.currentReturnLabel')}: {selected.end_date}
                  </p>
                </div>

                <label className="mt-4 block max-w-[10rem]">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t('admin.extensions.currentRentedCars.panel.extensionDaysLabel')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={extensionDaysInput}
                    onChange={(e) => setExtensionDaysInput(e.target.value)}
                    placeholder={t('admin.extensions.currentRentedCars.panel.extensionDaysHint')}
                    className={inputClass}
                  />
                  {extensionDaysInput && !daysValid && (
                    <p className="mt-1 text-xs font-medium text-error">{t('admin.extensions.currentRentedCars.panel.extensionDaysHint')}</p>
                  )}
                </label>

                {newReturnDate && (
                  <p className="mt-2 text-sm font-medium text-brand-navy">
                    {t('admin.extensions.currentRentedCars.panel.newReturnLabel')}: {newReturnDate}
                  </p>
                )}

                {availability.status === 'checking' && (
                  <p className="mt-2 text-xs text-text-muted">
                    {t('admin.extensions.form.checkingAvailability', { plate: selected.vehicles?.plate_number ?? '' })}
                  </p>
                )}
                {availability.status === 'done' && (
                  <p className={'mt-2 text-xs font-medium ' + (availability.available ? 'text-success' : 'text-warning')}>
                    {t(availability.available ? 'admin.extensions.form.availableMessage' : 'admin.extensions.form.unavailableMessage', {
                      plate: selected.vehicles?.plate_number ?? '',
                    })}
                  </p>
                )}

                <label className="mt-4 block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t('admin.extensions.currentRentedCars.panel.confirmedByLabel')}
                  </span>
                  <input
                    type="text"
                    value={supportConfirmedBy}
                    onChange={(e) => setSupportConfirmedBy(e.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="mt-4 block max-w-xs">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t('admin.extensions.form.paymentMethod')}
                  </span>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'online' | '')} className={inputClass}>
                    <option value="">{t('admin.extensions.form.choosePaymentMethod')}</option>
                    {isSuperAdmin && <option value="cash">{t('admin.extensions.form.paymentMethodCash')}</option>}
                    <option value="online">{t('admin.extensions.form.paymentMethodOnline')}</option>
                  </select>
                  {!isSuperAdmin && <p className="mt-1 text-xs text-text-muted">{t('admin.extensions.form.cashSuperAdminOnlyHint')}</p>}
                </label>

                {daysValid && (
                  <div className="mt-4 space-y-1 rounded-xl border border-brand-navy/10 bg-white p-3 text-sm">
                    {pricingPreview?.ok ? (
                      <>
                        <p className="text-xs text-text-muted">
                          {t('admin.extensions.currentRentedCars.panel.dailyRateLabel')}: {pricingPreview.currency}{' '}
                          {extensionDays ? (pricingPreview.amount / extensionDays).toLocaleString() : ''}
                        </p>
                        <p>
                          {t('admin.extensions.form.amountLabel')}: {pricingPreview.currency} {pricingPreview.amount.toLocaleString()}
                        </p>
                        {isLate && (
                          <p className="text-warning">
                            {penaltyPreview?.ok
                              ? `${t('admin.extensions.form.penaltyLabel')}: ${penaltyPreview.result?.currency} ${penaltyPreview.result?.amount.toLocaleString()}${
                                  penaltyPreview.result?.policy === 'percentage' ? ` (${penaltyPreview.result.rateUsed}%)` : ''
                                }`
                              : penaltyPreview?.message}
                          </p>
                        )}
                        {totalAmount != null && (
                          <p className="text-base font-bold text-brand-navy">
                            {t('admin.extensions.form.totalLabel')}: {pricingPreview.currency} {totalAmount.toLocaleString()}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs font-medium text-error">{pricingPreview?.message}</p>
                    )}
                  </div>
                )}

                {submitError && <p className="mt-3 text-sm font-medium text-error">{submitError}</p>}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canReview}
                    onClick={() => setStep('confirm')}
                    className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t('admin.extensions.currentRentedCars.panel.reviewButton')}
                  </button>
                  <button
                    type="button"
                    onClick={closePanel}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-brand-navy/80 hover:bg-surface-muted"
                  >
                    {t('admin.extensions.currentRentedCars.panel.cancelButton')}
                  </button>
                </div>
              </>
            )}

            {step === 'confirm' && pricingPreview?.ok && newReturnDate && (
              <>
                <h3 className="text-base font-semibold text-brand-navy">{t('admin.extensions.currentRentedCars.panel.confirmTitle')}</h3>

                <div className="mt-3 space-y-1.5 rounded-xl border border-brand-navy/10 bg-brand-lavender/10 p-4 text-sm">
                  <p className="font-semibold text-brand-navy">{selected.customers?.full_name ?? '—'}</p>
                  <p className="text-xs text-brand-navy/80">
                    {selected.vehicles?.make} {selected.vehicles?.model} · {selected.vehicles?.plate_number}
                  </p>
                  <p className="pt-2 text-xs text-text-muted">
                    {t('admin.extensions.currentRentedCars.panel.currentReturnLabel')}: {selected.end_date}
                  </p>
                  <p className="text-xs text-text-muted">
                    {t('admin.extensions.currentRentedCars.panel.extensionDaysLabel')}: {extensionDays}
                  </p>
                  <p className="font-medium text-brand-navy">
                    {t('admin.extensions.currentRentedCars.panel.newReturnLabel')}: {newReturnDate}
                  </p>
                  <div className="pt-2">
                    <p>
                      {t('admin.extensions.form.amountLabel')}: {pricingPreview.currency} {pricingPreview.amount.toLocaleString()}
                    </p>
                    {isLate && penaltyPreview?.ok && (
                      <p className="text-warning">
                        {t('admin.extensions.form.penaltyLabel')}: {penaltyPreview.result?.currency} {penaltyPreview.result?.amount.toLocaleString()}
                      </p>
                    )}
                    {totalAmount != null && (
                      <p className="text-base font-bold text-brand-navy">
                        {t('admin.extensions.form.totalLabel')}: {pricingPreview.currency} {totalAmount.toLocaleString()}
                      </p>
                    )}
                    <p className="mt-1 text-xs uppercase tracking-wide text-text-muted">
                      {t('admin.extensions.form.paymentMethod')}:{' '}
                      {t(paymentMethod === 'cash' ? 'admin.extensions.form.paymentMethodCash' : 'admin.extensions.form.paymentMethodOnline')}
                    </p>
                  </div>
                </div>

                {submitError && <p className="mt-3 text-sm font-medium text-error">{submitError}</p>}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleConfirm()}
                    className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? t('admin.extensions.currentRentedCars.panel.confirming') : t('admin.extensions.currentRentedCars.panel.confirmButton')}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setStep('form')}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-brand-navy/80 hover:bg-surface-muted"
                  >
                    {t('admin.extensions.currentRentedCars.panel.backButton')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy'
