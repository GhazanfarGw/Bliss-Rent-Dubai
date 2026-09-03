// Phase 9E — content (subject/title/message/status) for each extension
// and reassignment customer email, in EN and AR.
//
// Source of truth: the 4 `booking_notifications.notification_type` values
// from supabase/migrations/20260903000000_phase7_booking_reassignment.sql
// (`vehicle_reassigned`, `extension_approved`, `extension_rejected`,
// `extension_conflict_pending_review`) and the exact jsonb payload shape
// each one's INSERT statement builds — see the *Payload interfaces below,
// each with an inline citation of the migration line that produces it.
// This file only reads those payloads; it never writes to
// booking_notifications and never re-derives anything the SQL already
// decided (e.g. it does not recompute extension_days or re-check for a
// conflict — it just describes, in the customer's language, what the
// payload already says happened).
//
// Wording for `extension_rejected`'s reason and `vehicle_reassigned`'s
// plate numbers is free text / data from the database, not translatable —
// it is interpolated as-is (in whichever language the admin entered it,
// or as the plate actually is) into an otherwise-bilingual sentence,
// exactly like customerEmailContent.ts's approach to dynamic values. The
// whole resulting message string still passes through layout.ts's
// `escapeHtml(props.message)`, so this stays as safe as every other
// customer email — no new escaping responsibility is introduced here.

import type { StatusTone } from './types.ts'
import type { EmailLanguage } from './strings.ts'

export type ExtensionNotificationType =
  | 'vehicle_reassigned'
  | 'extension_approved'
  | 'extension_rejected'
  | 'extension_conflict_pending_review'

export const EXTENSION_NOTIFICATION_TYPES: ExtensionNotificationType[] = [
  'vehicle_reassigned',
  'extension_approved',
  'extension_rejected',
  'extension_conflict_pending_review',
]

export interface ExtensionEmailContent {
  subject: string
  title: string
  message: string
  statusTone: StatusTone
  statusMessage: string
}

/** jsonb_build_object(...) in resolve_extension_conflict(), 20260903000000_phase7_booking_reassignment.sql:479-487 */
export interface VehicleReassignedPayload {
  booking_reference?: string
  original_vehicle_plate?: string
  new_vehicle_plate?: string
  start_date?: string
  end_date?: string
  reason?: string
}

/** jsonb_build_object(...) in request_booking_extension() / confirm_booking_extension_payment(), e.g. 20260903000000_phase7_booking_reassignment.sql:713-715 */
export interface ExtensionApprovedPayload {
  requested_return_date?: string
  extension_days?: number
  amount?: number
  currency?: string
  penalty_amount?: number | null
}

/** jsonb_build_object('reason', ...) in reject_extension_request(), 20260903000000_phase7_booking_reassignment.sql:891 */
export interface ExtensionRejectedPayload {
  reason?: string
}

/** jsonb_build_object('note', ...) in resolve_extension_conflict(), 20260903000000_phase7_booking_reassignment.sql:437-438 — always this exact static sentence today. */
export interface ExtensionConflictPendingReviewPayload {
  note?: string
}

/** A payload field is technically `unknown` coming back from a jsonb column — this never throws on a missing/malformed field, it just renders a safe placeholder, since a notification already recorded in the database must never block delivery of the ones that follow it. */
function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function formatMoney(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString()}`
}

export function getExtensionNotificationContent(
  type: ExtensionNotificationType,
  language: EmailLanguage,
  payload: Record<string, unknown>,
): ExtensionEmailContent {
  switch (type) {
    case 'vehicle_reassigned':
      return vehicleReassignedContent(language, payload as VehicleReassignedPayload)
    case 'extension_approved':
      return extensionApprovedContent(language, payload as ExtensionApprovedPayload)
    case 'extension_rejected':
      return extensionRejectedContent(language, payload as ExtensionRejectedPayload)
    case 'extension_conflict_pending_review':
      return extensionConflictPendingReviewContent(language)
  }
}

function vehicleReassignedContent(language: EmailLanguage, payload: VehicleReassignedPayload): ExtensionEmailContent {
  const originalPlate = textOr(payload.original_vehicle_plate, '—')
  const newPlate = textOr(payload.new_vehicle_plate, '—')

  if (language === 'ar') {
    return {
      subject: 'تم تحديث مركبتك — بليس رنت',
      title: 'تم تحديث المركبة',
      message: `تم تغيير المركبة الخاصة بحجزك للحفاظ على تأكيد حجزك. المركبة السابقة: ${originalPlate}. المركبة الجديدة: ${newPlate}. تواريخ حجزك وسعره ورقمه المرجعي دون تغيير.`,
      statusTone: 'info',
      statusMessage: 'تم تحديث المركبة',
    }
  }
  return {
    subject: 'Your vehicle has been updated — Bliss Rent',
    title: 'Vehicle updated',
    message: `The vehicle for your booking has been changed to keep your reservation confirmed. Previous vehicle: ${originalPlate}. New vehicle: ${newPlate}. Your dates, price, and booking reference are unchanged.`,
    statusTone: 'info',
    statusMessage: 'Vehicle updated',
  }
}

function extensionApprovedContent(language: EmailLanguage, payload: ExtensionApprovedPayload): ExtensionEmailContent {
  const returnDate = textOr(payload.requested_return_date, '—')
  const days = numberOr(payload.extension_days, 0)
  const currency = textOr(payload.currency, '')
  const amount = numberOr(payload.amount, 0)
  const penaltyAmount = typeof payload.penalty_amount === 'number' && payload.penalty_amount > 0 ? payload.penalty_amount : null

  if (language === 'ar') {
    const dayWord = days === 1 ? 'يوم واحد' : `${days} أيام`
    const penaltyNote = penaltyAmount ? ` يشمل ذلك رسوم تمديد متأخر بقيمة ${formatMoney(currency, penaltyAmount)}.` : ''
    return {
      subject: 'تم تأكيد تمديد الإيجار — بليس رنت',
      title: 'تم تأكيد التمديد',
      message: `تم تمديد فترة إيجارك حتى ${returnDate} (${dayWord} إضافي). المبلغ المستحق: ${formatMoney(currency, amount)}.${penaltyNote}`,
      statusTone: 'success',
      statusMessage: 'تم تأكيد التمديد',
    }
  }
  const dayWord = days === 1 ? '1 extra day' : `${days} extra days`
  const penaltyNote = penaltyAmount ? ` This includes a ${formatMoney(currency, penaltyAmount)} late-extension fee.` : ''
  return {
    subject: 'Your rental extension is confirmed — Bliss Rent',
    title: 'Extension confirmed',
    message: `Your rental has been extended through ${returnDate} (${dayWord}). Amount charged: ${formatMoney(currency, amount)}.${penaltyNote}`,
    statusTone: 'success',
    statusMessage: 'Extension confirmed',
  }
}

function extensionRejectedContent(language: EmailLanguage, payload: ExtensionRejectedPayload): ExtensionEmailContent {
  const reason = textOr(
    payload.reason,
    language === 'ar' ? 'لم يتم تحديد سبب.' : 'No reason was provided.',
  )
  if (language === 'ar') {
    return {
      subject: 'تعذر الموافقة على طلب التمديد — بليس رنت',
      title: 'تم رفض طلب التمديد',
      message: `تعذرت الموافقة على طلب تمديد الإيجار الخاص بحجزك. السبب: ${reason}`,
      statusTone: 'warning',
      statusMessage: 'تم رفض طلب التمديد',
    }
  }
  return {
    subject: 'Your extension request could not be approved — Bliss Rent',
    title: 'Extension request declined',
    message: `Your rental extension request could not be approved. Reason: ${reason}`,
    statusTone: 'warning',
    statusMessage: 'Extension request declined',
  }
}

function extensionConflictPendingReviewContent(language: EmailLanguage): ExtensionEmailContent {
  // The payload's own 'note' field is always this exact static EN
  // sentence (see the interface's citation above) — there is nothing
  // customer-specific in it to interpolate, so both languages are
  // hand-written here rather than reading the payload at all.
  if (language === 'ar') {
    return {
      subject: 'طلب التمديد الخاص بك بحاجة إلى مراجعة — بليس رنت',
      title: 'طلب التمديد قيد المراجعة',
      message: 'يحتاج طلب تمديد الإيجار الخاص بك إلى مراجعة يدوية من فريقنا قبل إتمامه. سنتواصل معك قريباً.',
      statusTone: 'warning',
      statusMessage: 'قيد المراجعة',
    }
  }
  return {
    subject: 'Your extension request needs a quick review — Bliss Rent',
    title: 'Extension request under review',
    message: 'Your rental extension request needs manual review by our team before it can be completed. We will follow up with you shortly.',
    statusTone: 'warning',
    statusMessage: 'Needs review',
  }
}
