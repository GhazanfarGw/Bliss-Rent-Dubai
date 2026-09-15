import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Hash, UserRound, ShieldCheck, BadgeCheck } from 'lucide-react'
import { Button, StatusBadge, SelectField } from '@/features/shared/ui'
import { inputClass } from '@/features/shared/ui/inputClasses'
import { lookupBooking, BookingLookupError } from '@/features/booking/lookupApi'
import { lastNameMatches } from '@/features/booking/manageBookingVerify'
import { submitExtendRentalRequest, ExtendRentalError } from '@/features/booking/extendRentalApi'
import { useExtensionPriceEstimate } from '@/features/booking/useExtensionPriceEstimate'
import { ExtensionPriceEstimateNote } from '@/features/booking/ExtensionPriceEstimateNote'
import type { BookingLookupResult } from '@/types/domain'

type VerifyState =
  | { status: 'idle' }
  | { status: 'verifying' }
  | { status: 'error'; message: string }
  | { status: 'verified'; result: BookingLookupResult }

type ExtendStep =
  | { step: 'idle' }
  | { step: 'submitting' }
  | { step: 'submit_failed'; message: string }
  | { step: 'submitted'; isLate: boolean }

// Mirrors ManageBookingPage.tsx's own EXTENDABLE_STATUSES gate exactly —
// only a booking in one of these statuses can still be extended. Kept as
// a small local copy rather than a shared import so this panel stays a
// self-contained, presentational-only change; the backend
// (submit_extension_request_public) is the actual authority and would
// reject an extension request for any booking that isn't eligible
// regardless of what this UI shows.
const EXTENDABLE_STATUSES = new Set(['confirmed', 'active'])

// The existing, already-enforced business rule (see
// src/lib/extensionPricing.ts's computeExtensionAmount and
// submit_extension_request_public() in the database) is a 1-30 day
// bound — not a new limit invented for this panel.
const EXTENSION_DAY_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1)

/** Turns a selected day-count into the actual ISO date the existing,
 *  unchanged submitExtendRentalRequest()/submit-extension-request Edge
 *  Function already expects — purely a UI convenience, not a new
 *  business rule or date calculation the backend doesn't already do
 *  itself (extensionDaysBetween in extensionPricing.ts is the inverse of
 *  this). */
function addDaysToIsoDate(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Phase 11 correction — the homepage navigator's Manage Booking tab.
 * Unlike the /manage-booking page's own single-field lookup (reference OR
 * plate — see lookupApi.ts for that deliberate trade-off), this panel asks
 * for the Booking Reference AND Last Name together, per the corrected
 * spec. It still calls the SAME authoritative `lookupBooking()` RPC — no
 * second verification algorithm — and only adds a client-side last-name
 * check against the `customerName` that call already returns (see
 * manageBookingVerify.ts).
 *
 * Frontend UX fix (2026-09-05): a successful verify used to hand off to
 * the separate /manage-booking page via router state. Per direct request,
 * it no longer navigates anywhere — the verified result, and an inline
 * "request more days" form, both render right here in the Navigator.
 * Extending still goes through the exact same, unchanged
 * submitExtendRentalRequest() call (submit-extension-request Edge
 * Function -> submit_extension_request_public()) that ExtendRentalSection
 * on the standalone Manage Booking page uses — only the day-count-instead
 * -of-date-picker UI and the "stay on this panel" behavior are new. No
 * lookup, verification, extension, pricing, or backend logic changed.
 */
export function ManageBookingVerifyPanel() {
  const { t } = useTranslation()
  const [reference, setReference] = useState('')
  const [lastName, setLastName] = useState('')
  const [verifyState, setVerifyState] = useState<VerifyState>({ status: 'idle' })

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    if (!reference.trim() || !lastName.trim()) {
      setVerifyState({ status: 'error', message: t('home.navigator.manage.errorRequired') })
      return
    }

    setVerifyState({ status: 'verifying' })
    try {
      const result = await lookupBooking(reference)
      if (result && lastNameMatches(result.customerName, lastName)) {
        setVerifyState({ status: 'verified', result })
        return
      }
      // Deliberately the same generic message whether the reference doesn't
      // exist or the last name doesn't match it — never reveal which.
      setVerifyState({ status: 'error', message: t('home.navigator.manage.errorNotFound') })
    } catch (err) {
      setVerifyState({
        status: 'error',
        message: err instanceof BookingLookupError ? err.message : t('home.navigator.manage.errorGeneric'),
      })
    }
  }

  function handleVerifyAnother() {
    setVerifyState({ status: 'idle' })
    setReference('')
    setLastName('')
  }

  if (verifyState.status === 'verified') {
    return <VerifiedResult result={verifyState.result} onVerifyAnother={handleVerifyAnother} />
  }

  return (
    <div>
      <form onSubmit={(e) => void handleVerify(e)} noValidate className="grid gap-3 md:grid-cols-3 md:items-end">
        <label className="block min-w-0 flex-1">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('home.navigator.manage.referenceLabel')}
          </span>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t('home.navigator.manage.referencePlaceholder')}
            className={inputClass()}
            autoComplete="off"
          />
        </label>

        <label className="block min-w-0 flex-1">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('home.navigator.manage.lastNameLabel')}
          </span>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t('home.navigator.manage.lastNamePlaceholder')}
            className={inputClass()}
            autoComplete="family-name"
          />
        </label>

        <div className="min-w-0">
          <Button type="submit" loading={verifyState.status === 'verifying'} fullWidthOnMobile>
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            {verifyState.status === 'verifying' ? t('home.navigator.manage.verifying') : t('home.navigator.manage.submit')}
          </Button>
        </div>

        {verifyState.status === 'error' && (
          <p className="border border-error/25 bg-error-bg px-4 py-3 text-sm text-error md:col-span-3">{verifyState.message}</p>
        )}
      </form>
    </div>
  )
}

/**
 * Split out from ManageBookingVerifyPanel so the price-estimate hook
 * (useExtensionPriceEstimate — 2026-09-05) can be called unconditionally
 * at this component's top level, per the rules of hooks, rather than
 * inside the parent's `if (verifyState.status === 'verified')` branch.
 * Owns the day-selection + extend-submission state that used to live in
 * the parent; behavior is otherwise unchanged from before this split.
 */
function VerifiedResult({ result, onVerifyAnother }: { result: BookingLookupResult; onVerifyAnother: () => void }) {
  const { t } = useTranslation()
  const [selectedDays, setSelectedDays] = useState(1)
  const [extendState, setExtendState] = useState<ExtendStep>({ step: 'idle' })
  const canExtend = EXTENDABLE_STATUSES.has(result.bookingStatus)

  const estimate = useExtensionPriceEstimate({
    vehicleId: result.vehicleId,
    originalStartDate: result.startDate,
    originalEndDate: result.endDate,
    originalTotalPrice: result.totalPrice,
    originalCurrency: result.currency,
    extensionDays: canExtend ? selectedDays : null,
  })

  async function handleExtendSubmit(e: FormEvent) {
    e.preventDefault()
    if (extendState.step === 'submitting') return // guards against a double-click / duplicate submit
    const requestedReturnDate = addDaysToIsoDate(result.endDate, selectedDays)

    setExtendState({ step: 'submitting' })
    try {
      const submitResult = await submitExtendRentalRequest({
        bookingReference: result.bookingReference,
        vehicleNumber: result.vehiclePlate,
        requestedReturnDate,
      })
      setExtendState({ step: 'submitted', isLate: submitResult.isLate })
    } catch (err) {
      setExtendState({
        step: 'submit_failed',
        message: err instanceof ExtendRentalError ? err.message : t('manageBooking.genericError'),
      })
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <BadgeCheck className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
        <h2 className="font-hero-serif text-3xl font-black tracking-[-0.04em] text-brand-navy sm:text-4xl">
          {t('home.navigator.manage.result.heading')}
        </h2>
      </div>

      <div className="mt-6 space-y-3 rounded-2xl border border-brand-gold/20 bg-[linear-gradient(180deg,#ffffff_0%,#f9f5f1_100%)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-navy/8 pb-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold-dark">
              {t('home.navigator.manage.result.verifiedBadge')}
            </p>
            <span className="mt-1 block font-mono text-sm font-semibold text-brand-navy">{result.bookingReference}</span>
          </div>
          <StatusBadge status={result.bookingStatus} translationPrefix="admin.status" />
        </div>
        <Row label={t('checkout.confirmation.vehicle')} value={`${result.vehicleMake} ${result.vehicleModel}`} />
        <Row label={t('extendRental.vehicleNumberLabel')} value={result.vehiclePlate} />
        <Row label={t('checkout.confirmation.rentalDates')} value={`${result.startDate} → ${result.endDate}`} />
        <Row label={t('checkout.confirmation.pickup')} value={result.pickupLocationName} />
        <Row label={t('checkout.confirmation.dropoff')} value={result.dropoffLocationName} />
        <Row label={t('checkout.confirmation.customer')} value={result.customerName} />
        <Row label={t('checkout.confirmation.amount')} value={`${result.currency} ${result.totalPrice.toLocaleString()}`} />
        <Row
          label={t('checkout.confirmation.paymentStatus')}
          value={<StatusBadge status={result.paymentStatus} translationPrefix="admin.status" />}
        />
      </div>

      {canExtend && extendState.step !== 'submitted' && (
        <div className="mt-4 border-t border-brand-navy/10 pt-4">
          <h3 className="text-sm font-bold text-brand-navy">{t('extendRental.sectionTitle')}</h3>
          <p className="mt-1 text-xs text-text-muted">{t('home.navigator.manage.extend.intro')}</p>

          <form onSubmit={(e) => void handleExtendSubmit(e)} noValidate className="mt-3 space-y-3">
            <div className="max-w-xs">
              <SelectField
                label={t('home.navigator.manage.extend.daysLabel')}
                value={selectedDays}
                onChange={(e) => setSelectedDays(Number(e.target.value))}
              >
                {EXTENSION_DAY_OPTIONS.map((day) => (
                  <option key={day} value={day}>
                    {t('home.navigator.manage.extend.dayOption', { count: day })}
                  </option>
                ))}
              </SelectField>
            </div>

            <ExtensionPriceEstimateNote estimate={estimate} paidAmount={result.totalPrice} paidCurrency={result.currency} />

            <p className="rounded-lg border border-brand-lavender bg-brand-lavender/30 px-4 py-3 text-xs text-text-muted">
              {t('extendRental.notInstantNotice')}
            </p>

            <Button type="submit" variant="secondary" loading={extendState.step === 'submitting'} fullWidthOnMobile>
              {extendState.step === 'submitting' ? t('extendRental.submitting') : t('extendRental.submitButton')}
            </Button>

            {extendState.step === 'submit_failed' && (
              <p className="rounded-lg border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{extendState.message}</p>
            )}
          </form>
        </div>
      )}

      {extendState.step === 'submitted' && (
        <div className="mt-4 space-y-2 rounded-xl border border-success/25 bg-success-bg p-5 text-center">
          <BadgeCheck className="mx-auto h-6 w-6 text-success" aria-hidden="true" />
          <h3 className="text-sm font-bold text-brand-navy">{t('extendRental.result.submittedTitle')}</h3>
          <p className="text-xs text-text-muted">{t('extendRental.result.submittedBody')}</p>
          {extendState.isLate && <p className="text-xs text-warning">{t('extendRental.result.lateNote')}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={onVerifyAnother}
        className="mt-4 text-sm font-semibold text-brand-navy underline decoration-brand-gold decoration-2 underline-offset-4"
      >
        {t('home.navigator.manage.result.checkAnother')}
      </button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="text-right font-medium text-brand-navy">
        {typeof value === 'string' ? value.replace(/_/g, ' ') : value}
      </span>
    </div>
  )
}
