import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, CalendarRange, Clock, Hash, ShieldCheck, UserRound, X, type LucideIcon } from 'lucide-react'
import { Button, StatusBadge, SelectField } from '@/features/shared/ui'
import { inputClass } from '@/features/shared/ui/inputClasses'
import { lookupBooking, BookingLookupError } from '@/features/booking/lookupApi'
import { lastNameMatches } from '@/features/booking/manageBookingVerify'
import { submitExtendRentalRequest, ExtendRentalError } from '@/features/booking/extendRentalApi'
import { resumePendingBookingFromLookup } from '@/features/booking/checkout/checkoutStorage'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { daysRemaining } from '@/lib/dateRange'
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

// The database remains the authority; this only controls which single
// action (if any) the compact row offers.
const EXTENDABLE_STATUSES = new Set(['confirmed', 'active'])
const EXTENSION_DAY_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1)

function addDaysToIsoDate(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Homepage booking verification — a single compact row, not a details
 * page. The full /manage-booking page (ManageBookingPage.tsx) already
 * shows the complete booking view; this panel's only job is a quick
 * status check and the one relevant action, inside the same row the
 * lookup form itself used, so the homepage never grows a wall of content
 * below the navigator.
 *
 * Once verified, the row composition is entirely status-driven and
 * mutually exclusive — a booking that hasn't been paid for can't be
 * extended, so these never appear together:
 *  - pending_payment  → "Payment Pending" + Pay Now, which resumes the
 *    SAME booking straight into the existing checkout payment step (the
 *    one showing the WhatsApp payment CTA while Stripe checkout is
 *    paused — see PaymentPendingPage.tsx). Same handoff
 *    ManageBookingPage.tsx's handleContinueToPayment already uses.
 *  - confirmed/active → remaining days + an Extend Rental Days dropdown
 *    + Extend Rental, which submits an extension REQUEST via the
 *    existing submitExtendRentalRequest function — the same one
 *    ExtendRentalSection on the full page already uses.
 *  - anything else (completed/cancelled) → just the booking status,
 *    no action.
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
      // Keep this deliberately generic so the form never reveals whether a
      // reference exists when the surname does not match.
      setVerifyState({ status: 'error', message: t('home.navigator.manage.errorNotFound') })
    } catch (err) {
      setVerifyState({
        status: 'error',
        message: err instanceof BookingLookupError ? err.message : t('home.navigator.manage.errorGeneric'),
      })
    }
  }

  function handleReset() {
    setVerifyState({ status: 'idle' })
    setReference('')
    setLastName('')
  }

  if (verifyState.status === 'verified') {
    return <VerifiedRow result={verifyState.result} lastName={lastName} onReset={handleReset} />
  }

  return (
    <div>
      <form onSubmit={(e) => void handleVerify(e)} noValidate className="flex flex-wrap items-end gap-3">
        <label className="block min-w-40 flex-1">
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

        <label className="block min-w-36 flex-1">
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

        <Button type="submit" loading={verifyState.status === 'verifying'} fullWidthOnMobile>
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          {verifyState.status === 'verifying' ? t('home.navigator.manage.verifying') : t('home.navigator.manage.submit')}
        </Button>
      </form>

      {verifyState.status === 'error' && (
        <p className="mt-3 border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{verifyState.message}</p>
      )}
    </div>
  )
}

function CompactField({
  icon: Icon,
  label,
  value,
  tone = 'default',
  className = '',
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  tone?: 'default' | 'warning'
  className?: string
}) {
  return (
    <div className={'min-w-0 ' + className}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {label}
      </span>
      <p
        className={
          'flex h-11 items-center truncate rounded-lg border border-border bg-surface-muted px-3 text-sm font-bold ' +
          (tone === 'warning' ? 'text-warning' : 'text-brand-navy')
        }
      >
        {value}
      </p>
    </div>
  )
}

function VerifiedRow({
  result,
  lastName,
  onReset,
}: {
  result: BookingLookupResult
  lastName: string
  onReset: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [selectedDays, setSelectedDays] = useState(1)
  const [extendState, setExtendState] = useState<ExtendStep>({ step: 'idle' })
  const canResumePayment = result.bookingStatus === 'pending_payment'
  const canExtend = EXTENDABLE_STATUSES.has(result.bookingStatus)

  async function handleExtendSubmit() {
    if (extendState.step === 'submitting') return
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

  function handlePayNow() {
    // Resume the EXISTING booking found above — same handoff
    // ManageBookingPage.tsx's handleContinueToPayment uses, never a fresh
    // create-booking or availability check.
    resumePendingBookingFromLookup(result)
    const qs = criteriaToSearchParams({
      startDate: result.startDate,
      endDate: result.endDate,
      pickupLocationId: result.pickupLocationId,
      dropoffLocationId: result.dropoffLocationId,
    }).toString()
    navigate(`/checkout/${result.vehicleId}/payment/${result.bookingId}?${qs}`)
  }

  if (extendState.step === 'submitted') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-success">
          <BadgeCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-semibold text-brand-navy">
            {t('extendRental.result.submittedTitle')}
            {extendState.isLate && <span className="ms-2 font-normal text-warning">{t('extendRental.result.lateNote')}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="w-fit text-sm font-semibold text-brand-navy underline decoration-brand-gold decoration-2 underline-offset-4"
        >
          {t('home.navigator.manage.result.checkAnother')}
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <CompactField
          icon={Hash}
          label={t('home.navigator.manage.referenceLabel')}
          value={result.bookingReference}
          className="min-w-36 flex-1"
        />
        <CompactField icon={UserRound} label={t('home.navigator.manage.lastNameLabel')} value={lastName} className="min-w-28 flex-1" />

        {canResumePayment && (
          <>
            <CompactField
              icon={Clock}
              tone="warning"
              label={t('home.navigator.manage.result.paymentCardTitle')}
              value={t('home.navigator.manage.result.paymentPendingLabel')}
              className="min-w-36 flex-1"
            />
            <Button type="button" onClick={handlePayNow} fullWidthOnMobile>
              {t('home.navigator.manage.result.payNowButton')}
            </Button>
          </>
        )}

        {!canResumePayment && canExtend && (
          <>
            <CompactField
              icon={CalendarRange}
              label={t('home.navigator.manage.result.remainingDaysLabel')}
              value={t('home.navigator.status.result.daysLeftValue', { count: daysRemaining(result.endDate) })}
              className="min-w-32 flex-1"
            />
            <div className="min-w-40 flex-1">
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
            <Button
              type="button"
              onClick={() => void handleExtendSubmit()}
              loading={extendState.step === 'submitting'}
              fullWidthOnMobile
            >
              {extendState.step === 'submitting' ? t('extendRental.submitting') : t('home.navigator.manage.result.extendButton')}
            </Button>
          </>
        )}

        {!canResumePayment && !canExtend && (
          <CompactField
            icon={BadgeCheck}
            label={t('checkout.confirmation.bookingStatus')}
            value={<StatusBadge status={result.bookingStatus} translationPrefix="admin.status" />}
            className="min-w-32 flex-1"
          />
        )}

        <button
          type="button"
          onClick={onReset}
          aria-label={t('home.navigator.manage.result.checkAnother')}
          className="grid h-11 w-11 shrink-0 place-items-center border border-border text-text-muted transition-colors hover:border-brand-navy hover:text-brand-navy"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {extendState.step === 'submit_failed' && (
        <p className="mt-3 border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{extendState.message}</p>
      )}
    </div>
  )
}
