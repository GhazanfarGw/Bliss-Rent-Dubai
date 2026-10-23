import type { StatusTone } from './types.ts'
import type { EmailLanguage } from './strings.ts'

export type CustomerBookingEventType =
  | 'booking_received'
  | 'booking_confirmed'
  | 'payment_failed'
  | 'booking_cancelled'
  | 'pickup_reminder'
  | 'return_reminder'

export interface CustomerEmailContent {
  subject: string
  title: string
  message: string
  statusTone: StatusTone
  statusMessage: string
}

const CONTENT: Record<CustomerBookingEventType, Record<EmailLanguage, CustomerEmailContent>> = {
  booking_received: {
    en: { subject: 'Booking received — Bliss Rent', title: 'Booking received', message: 'Thank you for booking with Bliss Rent. Here are your booking details — your booking is confirmed once payment is completed.', statusTone: 'info', statusMessage: 'Payment pending' },
    ar: { subject: 'تم استلام الحجز — بليس رنت', title: 'تم استلام الحجز', message: 'شكراً لحجزك مع بليس رنت. فيما يلي تفاصيل حجزك — يتم تأكيد الحجز بعد إتمام الدفع.', statusTone: 'info', statusMessage: 'بانتظار الدفع' },
  },
  booking_confirmed: {
    en: { subject: 'Booking confirmed — Bliss Rent', title: 'Booking confirmed', message: 'Thank you for booking with Bliss Rent. Here are your booking details.', statusTone: 'success', statusMessage: 'Payment and booking confirmed' },
    ar: { subject: 'تم تأكيد الحجز — بليس رنت', title: 'تم تأكيد الحجز', message: 'شكراً لحجزك مع بليس رنت. فيما يلي تفاصيل حجزك.', statusTone: 'success', statusMessage: 'تم تأكيد الدفع والحجز' },
  },
  payment_failed: {
    en: { subject: 'Payment could not be completed — Bliss Rent', title: 'Payment failed', message: 'Your payment could not be completed and no charge was made. Please try again, or contact Bliss Rent support for help.', statusTone: 'danger', statusMessage: 'Payment not completed' },
    ar: { subject: 'تعذر إتمام الدفع — بليس رنت', title: 'فشلت عملية الدفع', message: 'تعذر إتمام عملية الدفع ولم يتم خصم أي مبلغ. يرجى المحاولة مرة أخرى، أو التواصل مع دعم بليس رنت للمساعدة.', statusTone: 'danger', statusMessage: 'لم يتم إتمام الدفع' },
  },
  booking_cancelled: {
    en: { subject: 'Booking cancelled — Bliss Rent', title: 'Booking cancelled', message: 'Your booking with Bliss Rent has been cancelled. If you have any questions, please contact Bliss Rent support.', statusTone: 'warning', statusMessage: 'Booking cancelled' },
    ar: { subject: 'تم إلغاء الحجز — بليس رنت', title: 'تم إلغاء الحجز', message: 'تم إلغاء حجزك مع بليس رنت. إذا كان لديك أي استفسار، يرجى التواصل مع دعم بليس رنت.', statusTone: 'warning', statusMessage: 'تم إلغاء الحجز' },
  },
  pickup_reminder: {
    en: { subject: 'Your rental starts tomorrow — Bliss Rent', title: 'Pickup reminder', message: 'A quick reminder that your rental starts tomorrow. Here are your booking details again.', statusTone: 'info', statusMessage: 'Pickup tomorrow' },
    ar: { subject: 'يبدأ إيجارك غداً — بليس رنت', title: 'تذكير بالاستلام', message: 'تذكير سريع بأن إيجارك يبدأ غداً. فيما يلي تفاصيل حجزك مرة أخرى.', statusTone: 'info', statusMessage: 'الاستلام غداً' },
  },
  return_reminder: {
    en: { subject: 'Your rental is due back tomorrow — Bliss Rent', title: 'Return reminder', message: 'A quick reminder that your rental is due back tomorrow. Here are your booking details again.', statusTone: 'info', statusMessage: 'Return due tomorrow' },
    ar: { subject: 'موعد تسليم إيجارك غداً — بليس رنت', title: 'تذكير بالتسليم', message: 'تذكير سريع بأن موعد تسليم إيجارك غداً. فيما يلي تفاصيل حجزك مرة أخرى.', statusTone: 'info', statusMessage: 'التسليم غداً' },
  },
}

export function getCustomerEmailContent(eventType: CustomerBookingEventType, language: EmailLanguage): CustomerEmailContent {
  return CONTENT[eventType][language]
}
