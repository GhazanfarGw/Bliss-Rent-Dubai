import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeCheck } from 'lucide-react'
import { submitExtendRentalRequest, ExtendRentalError } from '@/features/booking/extendRentalApi'
import { extensionDaysBetween } from '@/lib/extensionPricing'
import { Button } from '@/features/shared/ui/Button'
import { useExtensionPriceEstimate } from '@/features/booking/useExtensionPriceEstimate'
import { ExtensionPriceEstimateNote } from '@/features/booking/ExtensionPriceEstimateNote'

type Step =
  | { step: 'idle' }
  | { step: 'submitting' }
  | { step: 'submit_failed'; message: string }
  | { step: 'submitted'; isLate: boolean }

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-brand-navy outline-none transition-colors focus:border-brand-navy focus:ring-1 focus:ring-brand-navy'

export interface ExtendRentalSectionProps {
  bookingReference: string
  vehicleNumber: string
  currentReturnDate: string
  /** Added 2026-09-05 for the price-preview feature — all four already exist on the BookingLookupResult the caller (ManageBookingPage.tsx's ResultCard) already has in scope, so nothing new is fetched to supply these. */
  vehicleId: string
  originalStartDate: string
  currentTotalPrice: number
  currency: string
}

/**
 * The "request more days" half of the merged Manage Booking page. Split
 * out of the original standalone ExtendRentalPage so it can be dropped
 * straight into ManageBookingPage's result card once a booking has
 * already been found — the identity check that used to be this
 * component's own "step 1" is now whatever got the customer to a result
 * on Manage Booking in the first place (reference or vehicle plate), so
 * there is no separate verify step here: bookingReference and
 * vehicleNumber arrive as props, already known-good.
 *
 * Submitting does NOT extend the booking — it only creates a pending
 * request an admin must review (submit-extension-request Edge Function →
 * submit_extension_request_public()). There is no advance-notice window:
 * a request made after the return date has already passed is still
 * accepted (and may carry a configurable late-extension penalty the admin
 * applies during review).
 */
export function ExtendRentalSection({
  bookingReference,
  vehicleNumber,
  currentReturnDate,
  vehicleId,
  originalStartDate,
  currentTotalPrice,
  currency,
}: ExtendRentalSectionProps) {
  const { t } = useTranslation()
  const [requestedReturnDate, setRequestedReturnDate] = useState('')
  const [state, setState] = useState<Step>({ step: 'idle' })
  const selectedDays = requestedReturnDate ? extensionDaysBetween(currentReturnDate, requestedReturnDate) : null
  const estimate = useExtensionPriceEstimate({
    vehicleId,
    originalStartDate,
    originalEndDate: currentReturnDate,
    originalTotalPrice: currentTotalPrice,
    originalCurrency: currency,
    extensionDays: selectedDays,
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!requestedReturnDate) return
    setState({ step: 'submitting' })
    try {
      const result = await submitExtendRentalRequest({ bookingReference, vehicleNumber, requestedReturnDate })
      setState({ step: 'submitted', isLate: result.isLate })
    } catch (err) {
      setState({
        step: 'submit_failed',
        message: err instanceof ExtendRentalError ? err.message : t('manageBooking.genericError'),
      })
    }
  }

  if (state.step === 'submitted') {
    return (
      <div className="space-y-2 rounded-xl border border-success/25 bg-success-bg p-5 text-center">
        <BadgeCheck className="mx-auto h-6 w-6 text-success" aria-hidden="true" />
        <h3 className="text-sm font-bold text-brand-navy">{t('extendRental.result.submittedTitle')}</h3>
        <p className="text-xs text-text-muted">{t('extendRental.result.submittedBody')}</p>
        {state.isLate && <p className="text-xs text-warning">{t('extendRental.result.lateNote')}</p>}
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-text-muted">{t('extendRental.sectionIntro')}</p>

      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-3 space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t('extendRental.newReturnDateLabel')}
          </span>
          <input
            type="date"
            value={requestedReturnDate}
            min={currentReturnDate}
            onChange={(e) => setRequestedReturnDate(e.target.value)}
            className={inputClass}
          />
        </label>
        {requestedReturnDate && (
          <p className="text-xs text-text-muted">
            {t('extendRental.daysPreview', { count: extensionDaysBetween(currentReturnDate, requestedReturnDate) })}
          </p>
        )}

        {requestedReturnDate && (
          <ExtensionPriceEstimateNote estimate={estimate} paidAmount={currentTotalPrice} paidCurrency={currency} />
        )}

        <p className="rounded-lg border border-brand-lavender bg-brand-lavender/30 px-4 py-3 text-xs text-text-muted">
          {t('extendRental.notInstantNotice')}
        </p>

        <Button
          type="submit"
          variant="secondary"
          loading={state.step === 'submitting'}
          disabled={!requestedReturnDate}
          fullWidthOnMobile
        >
          {state.step === 'submitting' ? t('extendRental.submitting') : t('extendRental.submitButton')}
        </Button>

        {state.step === 'submit_failed' && (
          <p className="rounded-lg border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{state.message}</p>
        )}
      </form>
    </div>
  )
}
