// Phase 9D — content (title/message/status) for each customer booking
// email event, in EN and AR. Wording reuses the app's own existing
// terminology wherever an equivalent already exists in
// src/i18n/locales/{en,ar}.ts (checkout.confirmation.confirmed/received,
// the admin payment/booking status labels) — see the inline citation on
// each string. `booking_cancelled` and `payment_failed` don't have a
// direct customer-facing email equivalent anywhere yet (nothing has ever
// emailed a customer before this phase), so their body copy is new,
// plain, and deliberately unremarkable — not dressed up with invented
// business detail (no fee amounts, no reasons — see the Phase 9A
// decision to ship cancellation emails reason-less for now).
//
// SPAM-AVOIDANCE (Phase 9 report Section 24, and the 9D instruction to
// "make the behavior deterministic"): a booking is always created with
// its payment already 'pending' in this system — there is no later
// moment where a booking exists but payment status changes to pending
// separately. So 'booking_received' already communicates the pending
// payment state via its statusMessage, and there is deliberately NO
// separate 'payment_pending' event/email — sending one immediately after
// booking_received would be exactly the two-emails-in-seconds problem
// the report flags. This is a fixed content decision, not a per-call
// choice, so the same booking never produces both.

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
    en: {
      // 'Booking received' — checkout.confirmation.received (en.ts)
      subject: 'Booking received — Bliss Rent',
      title: 'Booking received',
      message: 'Thank you for booking with Bliss Rent. Here are your booking details — your booking is confirmed once payment is completed.',
      statusTone: 'info',
      // 'Pending' — admin payment status label (en.ts)
      statusMessage: 'Payment pending',
    },
    ar: {
      // 'تم استلام الحجز' — checkout.confirmation.received (ar.ts)
      subject: 'تم استلام الحجز — بليس رنت',
      title: 'تم استلام الحجز',
      message: 'شكراً لحجزك مع بليس رنت. فيما يلي تفاصيل حجزك — يتم تأكيد الحجز بعد إتمام الدفع.',
      statusTone: 'info',
      // 'بانتظار الدفع' — admin payment status label (ar.ts)
      statusMessage: 'بانتظار الدفع',
    },
  },
  booking_confirmed: {
    en: {
      // 'Booking confirmed' — checkout.confirmation.confirmed (en.ts)
      subject: 'Booking confirmed — Bliss Rent',
      title: 'Booking confirmed',
      message: 'Thank you for booking with Bliss Rent. Here are your booking details.',
      statusTone: 'success',
      statusMessage: 'Payment and booking confirmed',
    },
    ar: {
      // 'تم تأكيد الحجز' — checkout.confirmation.confirmed (ar.ts)
      subject: 'تم تأكيد الحجز — بليس رنت',
      title: 'تم تأكيد الحجز',
      message: 'شكراً لحجزك مع بليس رنت. فيما يلي تفاصيل حجزك.',
      statusTone: 'success',
      statusMessage: 'تم تأكيد الدفع والحجز',
    },
  },
  payment_failed: {
    en: {
      subject: 'Payment could not be completed — Bliss Rent',
      title: 'Payment failed',
      // wording mirrors payment.declined (en.ts): "no charge was made", offers a retry
      message: 'Your payment could not be completed and no charge was made. Please try again, or contact Bliss Rent support for help.',
      statusTone: 'danger',
      statusMessage: 'Payment not completed',
    },
    ar: {
      subject: 'تعذر إتمام الدفع — بليس رنت',
      title: 'فشلت عملية الدفع',
      // mirrors payment.declined (ar.ts)
      message: 'تعذر إتمام عملية الدفع ولم يتم خصم أي مبلغ. يرجى المحاولة مرة أخرى، أو التواصل مع دعم بليس رنت للمساعدة.',
      statusTone: 'danger',
      statusMessage: 'لم يتم إتمام الدفع',
    },
  },
  booking_cancelled: {
    en: {
      subject: 'Booking cancelled — Bliss Rent',
      title: 'Booking cancelled',
      // no reason field exists yet (Phase 9A decision: ship reason-less for now) — deliberately does not invent one
      message: 'Your booking with Bliss Rent has been cancelled. If you have any questions, please contact Bliss Rent support.',
      statusTone: 'warning',
      // 'Cancelled' — admin booking status label (en.ts)
      statusMessage: 'Booking cancelled',
    },
    ar: {
      subject: 'تم إلغاء الحجز — بليس رنت',
      title: 'تم إلغاء الحجز',
      message: 'تم إلغاء حجزك مع بليس رنت. إذا كان لديك أي استفسار، يرجى التواصل مع دعم بليس رنت.',
      statusTone: 'warning',
      // 'ملغى' — admin booking status label (ar.ts)
      statusMessage: 'تم إلغاء الحجز',
    },
  },
  // Phase 9G — the two reminder emails. No specific reminder window is
  // recorded anywhere in the Phase 9 decisions beyond "in scope, new
  // scheduled infrastructure" (see 20260914000000_phase9g_rental_reminders.sql's
  // header for the exact assumption this makes: 1 day before, sent once
  // per booking). Purely informational content — no fee amount, no
  // policy detail invented.
  pickup_reminder: {
    en: {
      subject: 'Your rental starts tomorrow — Bliss Rent',
      title: 'Pickup reminder',
      message: 'A quick reminder that your rental starts tomorrow. Here are your booking details again.',
      statusTone: 'info',
      statusMessage: 'Pickup tomorrow',
    },
    ar: {
      subject: 'يبدأ إيجارك غداً — بليس رنت',
      title: 'تذكير بالاستلام',
      message: 'تذكير سريع بأن إيجارك يبدأ غداً. فيما يلي تفاصيل حجزك مرة أخرى.',
      statusTone: 'info',
      statusMessage: 'الاستلام غداً',
    },
  },
  return_reminder: {
    en: {
      subject: 'Your rental is due back tomorrow — Bliss Rent',
      title: 'Return reminder',
      message: 'A quick reminder that your rental is due back tomorrow. Here are your booking details again.',
      statusTone: 'info',
      statusMessage: 'Return due tomorrow',
    },
    ar: {
      subject: 'موعد تسليم إيجارك غداً — بليس رنت',
      title: 'تذكير بالتسليم',
      message: 'تذكير سريع بأن موعد تسليم إيجارك غداً. فيما يلي تفاصيل حجزك مرة أخرى.',
      statusTone: 'info',
      statusMessage: 'التسليم غداً',
    },
  },
}

export function getCustomerEmailContent(eventType: CustomerBookingEventType, language: EmailLanguage): CustomerEmailContent {
  return CONTENT[eventType][language]
}
