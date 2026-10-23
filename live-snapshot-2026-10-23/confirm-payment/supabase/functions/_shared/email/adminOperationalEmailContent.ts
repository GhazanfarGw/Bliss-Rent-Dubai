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
    en: { subject: 'New booking received — Bliss Rent', alertType: 'New booking received', priority: 'normal' },
    ar: { subject: 'تم استلام حجز جديد — بليس رنت', alertType: 'تم استلام حجز جديد', priority: 'normal' },
  },
  admin_booking_confirmed: {
    en: { subject: 'Booking confirmed — payment received — Bliss Rent', alertType: 'Booking confirmed — payment received', priority: 'normal' },
    ar: { subject: 'تم تأكيد الحجز — تم استلام الدفع — بليس رنت', alertType: 'تم تأكيد الحجز — تم استلام الدفع', priority: 'normal' },
  },
  admin_payment_failed: {
    en: { subject: 'Payment failed — Bliss Rent', alertType: 'Payment failed', priority: 'attention', requiredAction: 'Follow up with the customer if they need help completing payment.' },
    ar: { subject: 'فشلت عملية الدفع — بليس رنت', alertType: 'فشلت عملية الدفع', priority: 'attention', requiredAction: 'تواصل مع العميل إذا احتاج إلى مساعدة لإتمام الدفع.' },
  },
  admin_booking_cancelled: {
    en: { subject: 'Booking cancelled — Bliss Rent', alertType: 'Booking cancelled', priority: 'normal' },
    ar: { subject: 'تم إلغاء الحجز — بليس رنت', alertType: 'تم إلغاء الحجز', priority: 'normal' },
  },
  admin_extension_requested: {
    en: { subject: 'New extension request awaiting review — Bliss Rent', alertType: 'New extension request', priority: 'attention', requiredAction: 'Review this request in the Extensions queue.' },
    ar: { subject: 'طلب تمديد جديد بانتظار المراجعة — بليس رنت', alertType: 'طلب تمديد جديد', priority: 'attention', requiredAction: 'راجع هذا الطلب في قائمة طلبات التمديد.' },
  },
}

export function getAdminOperationalEmailContent(
  eventType: AdminOperationalEventType,
  language: EmailLanguage,
): AdminOperationalEmailContent {
  return CONTENT[eventType][language]
}
