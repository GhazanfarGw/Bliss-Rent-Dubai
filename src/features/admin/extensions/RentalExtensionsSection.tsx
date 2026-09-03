import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { BadgeCheck, Calendar, CalendarPlus, Eye, XCircle } from 'lucide-react'
import {
  fetchExtensionsForBooking,
  fetchBookingForExtension,
  fetchExtensionPricingSettings,
  fetchExtensionPenaltySettings,
  checkVehicleAvailabilityForExtension,
  requestBookingExtension,
  processExtensionRequest,
  rejectExtensionRequest,
  confirmExtensionPayment,
  type BookingForExtension,
  type RequestExtensionResult,
} from '@/features/admin/extensions/adminExtensionsApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { useAdminAuth } from '@/features/admin/AdminAuthContext'
import { AdminStatusBadge } from '@/features/admin/shared/AdminStatusBadge'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import { computeExtensionAmount, ExtensionPricingError } from '@/lib/extensionPricing'
import { computeExtensionPenalty, ExtensionPenaltyError } from '@/lib/extensionPenalty'
import { validateExtensionForm } from '@/features/admin/extensions/extensionFormValidation'
import type { AdminExtensionWithDetails, ExtensionPricingSettingsRecord, ExtensionPenaltySettingsRecord } from '@/types/domain'
import type { Database } from '@/types/database'

type BookingStatus = Database['public']['Tables']['bookings']['Row']['status']

type ContextState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'loaded'
      history: AdminExtensionWithDetails[]
      bookingCtx: BookingForExtension | null
      settings: ExtensionPricingSettingsRecord
      penaltySettings: ExtensionPenaltySettingsRecord
    }

type AvailabilityState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'done'; available: boolean }
  | { status: 'error'; message: string }

type PendingPaymentAction = { extensionId: string; outcome: 'paid' | 'failed' }

const EMPTY_FORM = {
  requestedReturnDate: '',
  supportConfirmedBy: '',
  supportConfirmationNote: '',
  paymentMethod: '' as 'cash' | 'online' | '',
}

function isPastDate(dateIso: string): boolean {
  const todayIso = new Date().toISOString().slice(0, 10)
  return todayIso > dateIso
}

/**
 * Phase 7 (booking reassignment respec) — the record/process workflow for
 * one booking's rental extensions, embedded as a Section on
 * BookingDetailPage. Handles BOTH request channels through the SAME
 * engine: recording a fresh WhatsApp/support-confirmed request
 * (requestBookingExtension), and reviewing a customer-submitted
 * 'requested'/'conflict_unresolved' row from the website self-service flow
 * (processExtensionRequest) — see request_booking_extension's own "one
 * engine, two entry points" comment in
 * supabase/migrations/20260903000000_phase7_booking_reassignment.sql.
 * Everything checked here client-side (availability, pricing, penalty) is
 * a courtesy preview — the database re-validates everything for real.
 */
export function RentalExtensionsSection({
  bookingId,
  bookingStatus,
  onBookingChanged,
}: {
  bookingId: string
  bookingStatus: BookingStatus
  onBookingChanged: () => void
}) {
  const { t } = useTranslation()
  const { adminProfile } = useAdminAuth()
  // Business rule (2026-08-29, additive migration 20260908000000): cash
  // extensions require a super_admin. The database is the real, always-
  // enforced gate (is_super_admin() inside request_booking_extension) —
  // this is client-side defense in depth only, same pattern as the
  // extension pricing/penalty settings gating in AdminSettingsPage.
  const isSuperAdmin = adminProfile?.role === 'super_admin'
  const [ctx, setCtx] = useState<ContextState>({ status: 'loading' })
  const [showForm, setShowForm] = useState(false)
  const [reviewingExtensionId, setReviewingExtensionId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [availability, setAvailability] = useState<AvailabilityState>({ status: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<RequestExtensionResult | null>(null)

  const [pendingPayment, setPendingPayment] = useState<PendingPaymentAction | null>(null)
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const [rejectingExtensionId, setRejectingExtensionId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectBusy, setRejectBusy] = useState(false)
  const [rejectError, setRejectError] = useState<string | null>(null)

  async function loadContext() {
    setCtx({ status: 'loading' })
    try {
      const [history, bookingCtx, settings, penaltySettings] = await Promise.all([
        fetchExtensionsForBooking(bookingId),
        fetchBookingForExtension(bookingId),
        fetchExtensionPricingSettings(),
        fetchExtensionPenaltySettings(),
      ])
      setCtx({ status: 'loaded', history, bookingCtx, settings, penaltySettings })
    } catch (err) {
      setCtx({
        status: 'error',
        message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'),
      })
    }
  }

  useEffect(() => {
    void loadContext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  const bookingCtx = ctx.status === 'loaded' ? ctx.bookingCtx : null
  const previousReturnDate = bookingCtx?.booking.end_date ?? ''

  // Live availability preview — the same exact-vehicle, read-only RPC the
  // form's submit re-validates for real. Debounced so a date being typed
  // doesn't fire a request per keystroke.
  useEffect(() => {
    if (!bookingCtx || !form.requestedReturnDate) {
      setAvailability({ status: 'idle' })
      return
    }
    const validation = validateExtensionForm({
      previousReturnDate,
      requestedReturnDate: form.requestedReturnDate,
      supportConfirmedBy: form.supportConfirmedBy || 'x',
      paymentMethod: 'cash',
    })
    if (!validation.valid && validation.errors.requestedReturnDate) {
      setAvailability({ status: 'idle' })
      return
    }
    let cancelled = false
    setAvailability({ status: 'checking' })
    const timer = setTimeout(() => {
      checkVehicleAvailabilityForExtension(bookingId, form.requestedReturnDate)
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
  }, [form.requestedReturnDate, bookingCtx, bookingId])

  if (ctx.status === 'loading') {
    return (
      <Section title={t('admin.extensions.section.title')}>
        <div className="flex justify-center py-6">
          <Spinner className="h-6 w-6" />
        </div>
      </Section>
    )
  }

  if (ctx.status === 'error') {
    return (
      <Section title={t('admin.extensions.section.title')}>
        <StateMessage tone="error" title={t('admin.errorGeneric')} body={ctx.message} />
      </Section>
    )
  }

  const { history, settings, penaltySettings } = ctx
  const isEligibleStatus = bookingStatus === 'confirmed' || bookingStatus === 'active'
  const reviewQueue = history.filter((e) => e.status === 'requested' || e.status === 'conflict_unresolved')

  const validation = bookingCtx
    ? validateExtensionForm({
        previousReturnDate,
        requestedReturnDate: form.requestedReturnDate,
        supportConfirmedBy: reviewingExtensionId ? form.supportConfirmedBy || 'x' : form.supportConfirmedBy,
        paymentMethod: form.paymentMethod,
      })
    : null

  const isLate = form.requestedReturnDate ? isPastDate(previousReturnDate) : false

  const pricingPreview = (() => {
    if (!bookingCtx || !validation?.extensionDays) return null
    try {
      const result = computeExtensionAmount({
        settings: {
          policy: settings.policy,
          customDailyRate: settings.custom_daily_rate,
          customCurrency: settings.custom_currency,
        },
        extensionDays: validation.extensionDays,
        originalBooking: {
          startDate: bookingCtx.booking.start_date,
          endDate: bookingCtx.booking.end_date,
          totalPrice: bookingCtx.booking.total_price,
          currency: bookingCtx.booking.currency,
        },
        currentVehiclePricing: bookingCtx.vehiclePricing,
      })
      return { ok: true as const, ...result }
    } catch (err) {
      return { ok: false as const, message: err instanceof ExtensionPricingError ? err.message : t('admin.errorGeneric') }
    }
  })()

  const penaltyPreview = (() => {
    if (!validation?.extensionDays) return null
    try {
      const result = computeExtensionPenalty({
        settings: {
          policy: penaltySettings.policy,
          fixedFeeAmount: penaltySettings.fixed_fee_amount,
          perDayAmount: penaltySettings.per_day_amount,
          percentageRate: penaltySettings.percentage_rate,
          currency: penaltySettings.currency,
        },
        isLate,
        extensionDays: validation.extensionDays,
        extensionAmount: pricingPreview?.ok ? pricingPreview.amount : 0,
      })
      return { ok: true as const, result }
    } catch (err) {
      return { ok: false as const, message: err instanceof ExtensionPenaltyError ? err.message : t('admin.errorGeneric') }
    }
  })()

  function resetForm() {
    setForm(EMPTY_FORM)
    setAvailability({ status: 'idle' })
    setSubmitError(null)
    setReviewingExtensionId(null)
  }

  function openReview(ext: AdminExtensionWithDetails) {
    setReviewingExtensionId(ext.id)
    setForm({
      requestedReturnDate: ext.requested_return_date,
      supportConfirmedBy: ext.support_confirmed_by ?? '',
      supportConfirmationNote: ext.support_confirmation_note ?? '',
      paymentMethod: (ext.payment_method as 'cash' | 'online' | null) ?? '',
    })
    setSubmitError(null)
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!bookingCtx || !validation || submitting) return
    if (!validation.valid || !validation.extensionDays) return
    if (!pricingPreview?.ok) {
      setSubmitError(pricingPreview?.message ?? t('admin.extensions.form.pricingNotConfigured'))
      return
    }
    if (isLate && !penaltyPreview?.ok) {
      setSubmitError(penaltyPreview?.message ?? t('admin.extensions.form.penaltyNotConfigured'))
      return
    }
    if (form.paymentMethod === 'cash' && !isSuperAdmin) {
      // Defense in depth only — the database rejects this regardless (see
      // migration header). The <select> below already hides "cash" for a
      // non-super_admin, so this only guards a stale role in memory.
      setSubmitError(t('admin.extensions.form.cashSuperAdminOnly'))
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const input = {
        bookingId,
        requestedReturnDate: form.requestedReturnDate,
        supportConfirmedBy: form.supportConfirmedBy.trim() || null,
        supportConfirmationNote: form.supportConfirmationNote.trim() || null,
        paymentMethod: form.paymentMethod as 'cash' | 'online',
        amount: pricingPreview.amount,
        currency: pricingPreview.currency,
        pricingPolicyUsed: pricingPreview.policy,
        penaltyAmount: isLate && penaltyPreview?.ok ? penaltyPreview.result?.amount ?? null : null,
        penaltyPolicyUsed: isLate && penaltyPreview?.ok ? penaltyPreview.result?.policy ?? null : null,
        penaltyRateUsed: isLate && penaltyPreview?.ok ? penaltyPreview.result?.rateUsed ?? null : null,
      }
      const result = reviewingExtensionId ? await processExtensionRequest(reviewingExtensionId, input) : await requestBookingExtension(input)
      setLastResult(result)
      setShowForm(false)
      resetForm()
      await loadContext()
      onBookingChanged()
    } catch (err) {
      setSubmitError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmPendingPayment() {
    if (!pendingPayment) return
    setPaymentBusy(true)
    setPaymentError(null)
    try {
      await confirmExtensionPayment(pendingPayment.extensionId, pendingPayment.outcome, paymentReference.trim() || null)
      setPendingPayment(null)
      setPaymentReference('')
      await loadContext()
      onBookingChanged()
    } catch (err) {
      setPaymentError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setPaymentBusy(false)
    }
  }

  async function confirmReject() {
    if (!rejectingExtensionId || !rejectReason.trim()) return
    setRejectBusy(true)
    setRejectError(null)
    try {
      await rejectExtensionRequest(rejectingExtensionId, rejectReason.trim())
      setRejectingExtensionId(null)
      setRejectReason('')
      await loadContext()
      onBookingChanged()
    } catch (err) {
      setRejectError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setRejectBusy(false)
    }
  }

  return (
    <Section title={t('admin.extensions.section.title')} full>
      <p className="text-sm text-text-muted">{t('admin.extensions.section.intro')}</p>

      {lastResult && (
        <div
          className={
            'mt-4 rounded-xl border p-4 text-sm ' +
            (lastResult.status === 'rejected'
              ? 'border-error/25 bg-error-bg text-error'
              : lastResult.status === 'conflict_unresolved'
                ? 'border-warning/25 bg-warning-bg text-warning'
                : 'border-success/25 bg-success-bg text-success')
          }
        >
          <p className="font-semibold">
            {lastResult.status === 'rejected'
              ? t('admin.extensions.result.rejectedTitle')
              : lastResult.status === 'conflict_unresolved'
                ? t('admin.extensions.result.conflictUnresolvedTitle')
                : t('admin.extensions.result.approvedTitle')}
          </p>
          <p className="mt-1">
            {lastResult.status === 'rejected'
              ? lastResult.rejectionReason
              : lastResult.status === 'conflict_unresolved'
                ? t('admin.extensions.result.conflictUnresolvedBody')
                : lastResult.paymentStatus === 'paid'
                  ? t('admin.extensions.result.approvedCashBody', { date: form.requestedReturnDate || '' })
                  : t('admin.extensions.result.approvedOnlineBody')}
          </p>
          {lastResult.status !== 'rejected' && lastResult.conflictBookingId && lastResult.replacementVehicleId && (
            <p className="mt-1 text-xs">{t('admin.extensions.conflict.resolvedNotice', { plate: t('admin.extensions.conflict.viewReassignment') })}</p>
          )}
          {lastResult.status === 'conflict_unresolved' && <p className="mt-1 text-xs">{t('admin.extensions.conflict.unresolvedNotice')}</p>}
          <button type="button" onClick={() => setLastResult(null)} className="mt-2 text-xs font-semibold underline">
            {t('admin.extensions.result.dismiss')}
          </button>
        </div>
      )}

      {!bookingCtx && (
        <div className="mt-4">
          <StateMessage tone="neutral" title={t('admin.extensions.section.noVehicle')} />
        </div>
      )}

      {bookingCtx && reviewQueue.length > 0 && (
        <div className="mt-4 rounded-xl border border-brand-navy/10 bg-brand-lavender/10 p-4">
          <h3 className="text-sm font-semibold text-brand-navy">{t('admin.extensions.section.reviewTitle')}</h3>
          <p className="mt-1 text-xs text-text-muted">{t('admin.extensions.section.reviewIntro')}</p>
          <div className="mt-3 space-y-2">
            {reviewQueue.map((ext) => (
              <div key={ext.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-navy/10 bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <AdminStatusBadge status={ext.status} />
                  <span className="inline-flex items-center gap-1 text-brand-navy/80">
                    <Calendar className="h-3 w-3 shrink-0 text-brand-gold" aria-hidden="true" />
                    {ext.previous_return_date} → {ext.requested_return_date} ({ext.extension_days}d)
                  </span>
                  {ext.is_late && (
                    <span className="rounded-full bg-warning-bg px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                      {t('admin.extensions.table.late')}
                    </span>
                  )}
                  {ext.status === 'conflict_unresolved' && (
                    <span className="max-w-xs text-warning">{t('admin.extensions.conflict.unresolvedNotice')}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {rejectingExtensionId === ext.id ? (
                    <div className="flex flex-col items-end gap-2">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder={t('admin.extensions.section.rejectPrompt')}
                        className="w-64 rounded-lg border border-border px-2 py-1 text-xs outline-none focus:border-brand-navy"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={rejectBusy || !rejectReason.trim()}
                          onClick={() => void confirmReject()}
                          className="rounded-lg bg-error px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {rejectBusy ? '…' : t('admin.extensions.payment.yes')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingExtensionId(null)
                            setRejectReason('')
                          }}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-muted"
                        >
                          {t('admin.extensions.payment.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openReview(ext)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-gold-light"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('admin.extensions.section.reviewButton')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingExtensionId(ext.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-muted"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('admin.extensions.section.rejectButton')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {rejectError && <p className="mt-2 text-xs font-medium text-error">{rejectError}</p>}
        </div>
      )}

      {bookingCtx && !isEligibleStatus && (
        <p className="mt-4 rounded-lg border border-warning/25 bg-warning-bg px-4 py-3 text-sm text-warning">
          {t('admin.extensions.section.notEligible')}
        </p>
      )}

      {bookingCtx && isEligibleStatus && (
        <div className="mt-4">
          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-gold-light"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              {t('admin.extensions.section.recordButton')}
            </button>
          )}

          {showForm && (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-xl border border-brand-navy/10 bg-brand-lavender/10 p-4">
              <h3 className="text-sm font-semibold text-brand-navy">
                {reviewingExtensionId ? t('admin.extensions.form.reviewTitle') : t('admin.extensions.form.title')}
              </h3>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('admin.extensions.form.requestedReturnDate')}
                </span>
                {reviewingExtensionId ? (
                  <p className="text-sm font-medium text-brand-navy">{form.requestedReturnDate}</p>
                ) : (
                  <input
                    type="date"
                    min={previousReturnDate}
                    value={form.requestedReturnDate}
                    onChange={(e) => setForm((f) => ({ ...f, requestedReturnDate: e.target.value }))}
                    className={inputClass}
                  />
                )}
                {validation?.errors.requestedReturnDate && (
                  <p className="mt-1 text-xs font-medium text-error">{validation.errors.requestedReturnDate}</p>
                )}
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('admin.extensions.form.supportConfirmedBy')}
                </span>
                <input
                  type="text"
                  value={form.supportConfirmedBy}
                  onChange={(e) => setForm((f) => ({ ...f, supportConfirmedBy: e.target.value }))}
                  placeholder={t('admin.extensions.form.supportConfirmedByPlaceholder')}
                  className={inputClass}
                />
                {reviewingExtensionId ? (
                  <p className="mt-1 text-xs text-text-muted">{t('admin.extensions.form.supportConfirmedByOptionalNote')}</p>
                ) : (
                  validation?.errors.supportConfirmedBy && (
                    <p className="mt-1 text-xs font-medium text-error">{validation.errors.supportConfirmedBy}</p>
                  )
                )}
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('admin.extensions.form.supportConfirmationNote')}
                </span>
                <textarea
                  value={form.supportConfirmationNote}
                  onChange={(e) => setForm((f) => ({ ...f, supportConfirmationNote: e.target.value }))}
                  placeholder={t('admin.extensions.form.supportConfirmationNotePlaceholder')}
                  rows={2}
                  className={inputClass}
                />
              </label>

              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('admin.extensions.form.paymentMethod')}
                </span>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as 'cash' | 'online' | '' }))}
                  className={inputClass}
                >
                  <option value="">{t('admin.extensions.form.choosePaymentMethod')}</option>
                  {isSuperAdmin && <option value="cash">{t('admin.extensions.form.paymentMethodCash')}</option>}
                  <option value="online">{t('admin.extensions.form.paymentMethodOnline')}</option>
                </select>
                {!isSuperAdmin && <p className="mt-1 text-xs text-text-muted">{t('admin.extensions.form.cashSuperAdminOnlyHint')}</p>}
                {validation?.errors.paymentMethod && (
                  <p className="mt-1 text-xs font-medium text-error">{validation.errors.paymentMethod}</p>
                )}
              </label>

              {availability.status === 'checking' && (
                <p className="text-xs text-text-muted">
                  {t('admin.extensions.form.checkingAvailability', { plate: bookingCtx.vehicle.plate_number })}
                </p>
              )}
              {availability.status === 'done' && (
                <p className={'text-xs font-medium ' + (availability.available ? 'text-success' : 'text-warning')}>
                  {t(availability.available ? 'admin.extensions.form.availableMessage' : 'admin.extensions.form.unavailableMessage', {
                    plate: bookingCtx.vehicle.plate_number,
                  })}
                </p>
              )}
              {availability.status === 'error' && <p className="text-xs text-warning">{t('admin.extensions.form.availabilityError')}</p>}

              {validation?.extensionDays ? (
                pricingPreview?.ok ? (
                  <p className="text-sm font-semibold text-brand-navy">
                    {t('admin.extensions.form.amountLabel')}: {pricingPreview.currency} {pricingPreview.amount.toLocaleString()}
                  </p>
                ) : (
                  <p className="text-xs font-medium text-error">{pricingPreview?.message}</p>
                )
              ) : null}

              {isLate && (
                <div className="rounded-lg border border-warning/25 bg-warning-bg px-3 py-2">
                  <p className="text-xs font-medium text-warning">{t('admin.extensions.form.lateNotice')}</p>
                  {penaltyPreview?.ok ? (
                    <p className="mt-1 text-sm font-semibold text-brand-navy">
                      {t('admin.extensions.form.penaltyLabel')}: {penaltyPreview.result?.currency} {penaltyPreview.result?.amount.toLocaleString()}
                      {penaltyPreview.result?.policy === 'percentage' && ` (${penaltyPreview.result.rateUsed}%)`}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-error">{penaltyPreview?.message}</p>
                  )}
                </div>
              )}

              {validation?.extensionDays && pricingPreview?.ok && (!isLate || penaltyPreview?.ok) && (
                <p className="text-sm font-bold text-brand-navy">
                  {t('admin.extensions.form.totalLabel')}: {pricingPreview.currency}{' '}
                  {(pricingPreview.amount + (isLate ? penaltyPreview?.result?.amount ?? 0 : 0)).toLocaleString()}
                </p>
              )}

              {submitError && <p className="text-sm font-medium text-error">{submitError}</p>}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? t('admin.extensions.form.submitting') : t('admin.extensions.form.submit')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted hover:bg-surface-muted"
                >
                  {t('admin.extensions.section.cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-brand-navy">{t('admin.extensions.section.historyTitle')}</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">{t('admin.extensions.section.historyEmpty')}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-brand-navy/10 text-start text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <th className="py-2 pe-3 text-start">{t('admin.extensions.table.source')}</th>
                  <th className="py-2 pe-3 text-start">{t('admin.extensions.table.dates')}</th>
                  <th className="py-2 pe-3 text-start">{t('admin.extensions.table.days')}</th>
                  <th className="py-2 pe-3 text-start">{t('admin.extensions.table.amount')}</th>
                  <th className="py-2 pe-3 text-start">{t('admin.extensions.table.penalty')}</th>
                  <th className="py-2 pe-3 text-start">{t('admin.extensions.table.total')}</th>
                  <th className="py-2 pe-3 text-start">{t('admin.extensions.table.payment')}</th>
                  <th className="py-2 pe-3 text-start">{t('admin.extensions.table.status')}</th>
                  <th className="py-2 pe-3 text-start">{t('admin.extensions.table.confirmedBy')}</th>
                  <th className="py-2 ps-3 text-end">{t('admin.extensions.section.recordButton')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-navy/5">
                {history.map((ext) => {
                  const isConfirmingPayment = pendingPayment?.extensionId === ext.id
                  const canConfirmPayment = ext.status === 'pending' && ext.payment_method === 'online' && ext.payment_status === 'pending'
                  return (
                    <tr key={ext.id}>
                      <td className="py-3 pe-3 text-xs">{t(`admin.extensions.source.${ext.source}`)}</td>
                      <td className="py-3 pe-3 text-xs">
                        {ext.previous_return_date} → {ext.requested_return_date}
                        {ext.is_late && (
                          <span className="ms-1.5 inline-flex items-center rounded-full bg-warning-bg px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                            {t('admin.extensions.table.late')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pe-3">{ext.extension_days}</td>
                      <td className="py-3 pe-3">{ext.amount != null ? `${ext.currency} ${ext.amount.toLocaleString()}` : '—'}</td>
                      <td className="py-3 pe-3">
                        {ext.penalty_amount != null
                          ? `${ext.currency} ${ext.penalty_amount.toLocaleString()}` +
                            (ext.penalty_policy_used === 'percentage' && ext.penalty_rate_used != null ? ` (${ext.penalty_rate_used}%)` : '')
                          : '—'}
                      </td>
                      <td className="py-3 pe-3 font-semibold">
                        {ext.amount != null ? `${ext.currency} ${(ext.amount + (ext.penalty_amount ?? 0)).toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 pe-3">
                        {ext.payment_method ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs capitalize text-text-muted">
                              {t(`admin.extensions.form.paymentMethod${ext.payment_method === 'cash' ? 'Cash' : 'Online'}`)}
                            </span>
                            {ext.payment_status && <AdminStatusBadge status={ext.payment_status} />}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 pe-3">
                        <AdminStatusBadge status={ext.status} />
                        {ext.status === 'rejected' && ext.rejection_reason && (
                          <p className="mt-1 max-w-[16rem] text-xs text-text-muted">{ext.rejection_reason}</p>
                        )}
                        {ext.conflict_booking_id && ext.replacement_vehicle && (
                          <p className="mt-1 max-w-[16rem] text-xs text-text-muted">
                            {t('admin.extensions.conflict.resolvedNotice', { plate: ext.replacement_vehicle.plate_number })}
                          </p>
                        )}
                        {ext.status === 'conflict_unresolved' && (
                          <p className="mt-1 max-w-[16rem] text-xs text-warning">{t('admin.extensions.conflict.unresolvedNotice')}</p>
                        )}
                      </td>
                      <td className="py-3 pe-3 text-xs text-text-muted">{ext.support_confirmed_by ?? '—'}</td>
                      <td className="py-3 ps-3 text-end">
                        {canConfirmPayment ? (
                          isConfirmingPayment ? (
                            <div className="flex flex-col items-end gap-2">
                              <input
                                type="text"
                                value={paymentReference}
                                onChange={(e) => setPaymentReference(e.target.value)}
                                placeholder={t('admin.extensions.payment.referenceLabel')}
                                className="w-44 rounded-lg border border-border px-2 py-1 text-xs outline-none focus:border-brand-navy"
                              />
                              <span className="text-xs text-brand-navy">
                                {t(
                                  pendingPayment.outcome === 'paid'
                                    ? 'admin.extensions.payment.confirmReceivedPrompt'
                                    : 'admin.extensions.payment.confirmFailedPrompt',
                                  { amount: ext.amount != null ? `${ext.currency} ${ext.amount.toLocaleString()}` : '' },
                                )}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={paymentBusy}
                                  onClick={() => void confirmPendingPayment()}
                                  className="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {paymentBusy ? '…' : t('admin.extensions.payment.yes')}
                                </button>
                                <button
                                  type="button"
                                  disabled={paymentBusy}
                                  onClick={() => {
                                    setPendingPayment(null)
                                    setPaymentReference('')
                                  }}
                                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-muted"
                                >
                                  {t('admin.extensions.payment.cancel')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setPendingPayment({ extensionId: ext.id, outcome: 'paid' })}
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-muted"
                              >
                                <BadgeCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                                {t('admin.extensions.payment.markReceived')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingPayment({ extensionId: ext.id, outcome: 'failed' })}
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-muted"
                              >
                                <XCircle className="h-3.5 w-3.5 text-error" aria-hidden="true" />
                                {t('admin.extensions.payment.markFailed')}
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {paymentError && <p className="mt-3 text-sm font-medium text-error">{paymentError}</p>}
          </div>
        )}
      </div>
    </Section>
  )
}

function Section({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={'rounded-2xl border border-brand-navy/10 bg-white p-5' + (full ? ' lg:col-span-2' : '')}>
      <h2 className="text-sm font-semibold text-brand-navy">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy'
