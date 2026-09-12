// Phase 9F — content (subject/alertType/priority/requiredAction) for each
// admin operational email event, in EN and AR. Mirrors 9D's
// customerEmailContent.ts exactly, one level over: this is the ADMIN
// side of the same real, already-decided events, not a new catalog.
//
// Every event here maps 1:1 to something that already exists and already
// fires today:
//   - admin_booking_received / admin_booking_confirmed / admin_payment_failed
//     mirror 9D's customer-facing booking_received / booking_confirmed /
//     payment_failed — same hook (create-booking / confirm-payment), same
//     "no separate payment_pending, no generic status-changed" restraint
//     (see customerEmailContent.ts's own file header for why).
//   - admin_booking_cancelled mirrors 9D's customer-facing
//     booking_cancelled — same reason-less-for-now Phase 9A decision, no
//     cancellation reason invented here either.
//   - admin_extension_requested has no customer-side equivalent: 9E only
//     emails the CUSTOMER about an extension's eventual outcome
//     (approved/rejected/conflict/reassigned). Nothing previously told an
//     admin that a new self-service request was even sitting in their
//     queue (fetchPendingExtensionRequests) waiting to be reviewed — this
//     is that missing half, sourced from the real, existing
//     submit_extension_request_public() insert (status='requested',
//     source='customer'), not an invented workflow.
//
// requiredAction is left unset (purely informational) for every event
// where nothing new exists for an admin to click through and do beyond
// what the dashboard already shows — a "prepare the vehicle" or
// "handover checklist" instruction would be inventing a business process
// that doesn't exist in this schema. It is set only where a genuine,
// already-existing admin action applies: following up on a failed
// payment, and reviewing a pending extension request in the Extensions
// queue.

import type { AdminPriority } from './types.ts'
import type { EmailLanguage } from './strings.ts'

export type AdminOperationalEventType =
  | 'admin_booking_received'
  | 'admin_booking_confirmed'
  | 'admin_payment_failed'
  | 'admin_booking_cancelled'
  | 'admin_extension_requested'

export const ADMIN_OPERATIONAL_EVENT_TYPES: AdminOperationalEventType[] = [
  'admin_booking_received',
  'admin_booking_confirmed',
  'admin_payment_failed',
  'admin_booking_cancelled',
  'admin_extension_requested',
]

export interface AdminOperationalEmailContent {
  subject: string
  alertType: string
  priority: AdminPriority
  requiredAction?: string
}

const CONTENT: Record<AdminOperationalEventType, Record<EmailLanguage, AdminOperationalEmailContent>> = {
  admin_booking_received: {
    en: {
      subject: 'New booking received — Bliss Rent',
      alertType: 'New booking received',
      priority: 'normal',
    },
    ar: {
      subject: 'تم استلام حجز جديد — بليس رنت',
      alertType: 'تم استلام حجز جديد',
      priority: 'normal',
    },
  },
  admin_booking_confirmed: {
    en: {
      subject: 'Booking confirmed — payment received — Bliss Rent',
      alertType: 'Booking confirmed — payment received',
      priority: 'normal',
    },
    ar: {
      subject: 'تم تأكيد الحجز — تم استلام الدفع — بليس رنت',
      alertType: 'تم تأكيد الحجز — تم استلام الدفع',
      priority: 'normal',
    },
  },
  admin_payment_failed: {
    en: {
      subject: 'Payment failed — Bliss Rent',
      alertType: 'Payment failed',
      priority: 'attention',
      requiredAction: 'Follow up with the customer if they need help completing payment.',
    },
    ar: {
      subject: 'فشلت عملية الدفع — بليس رنت',
      alertType: 'فشلت عملية الدفع',
      priority: 'attention',
      requiredAction: 'تواصل مع العميل إذا احتاج إلى مساعدة لإتمام الدفع.',
    },
  },
  admin_booking_cancelled: {
    en: {
      subject: 'Booking cancelled — Bliss Rent',
      alertType: 'Booking cancelled',
      priority: 'normal',
    },
    ar: {
      subject: 'تم إلغاء الحجز — بليس رنت',
      alertType: 'تم إلغاء الحجز',
      priority: 'normal',
    },
  },
  admin_extension_requested: {
    en: {
      subject: 'New extension request awaiting review — Bliss Rent',
      alertType: 'New extension request',
      priority: 'attention',
      requiredAction: 'Review this request in the Extensions queue.',
    },
    ar: {
      subject: 'طلب تمديد جديد بانتظار المراجعة — بليس رنت',
      alertType: 'طلب تمديد جديد',
      priority: 'attention',
      requiredAction: 'راجع هذا الطلب في قائمة طلبات التمديد.',
    },
  },
}

export function getAdminOperationalEmailContent(
  eventType: AdminOperationalEventType,
  language: EmailLanguage,
): AdminOperationalEmailContent {
  return CONTENT[eventType][language]
}
