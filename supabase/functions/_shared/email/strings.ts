// Shared EN/AR chrome strings for the email design system.
//
// Every value below that also appears in the live app is copied
// character-for-character from src/i18n/locales/{en,ar}.ts — mainly the
// `booking.confirmation` block, which is the closest existing surface to
// what a booking email says. This is deliberate (Section 12 of the
// Phase 9 report): reuse existing, already-approved terminology instead
// of inventing a second vocabulary for the same concepts.
//
// A handful of strings (the admin-only chrome, and generic email
// framing like "automated notification") don't have an existing
// customer-facing equivalent in en.ts/ar.ts because nothing like an
// admin notification email has existed before this phase — those are
// new, plain operational copy, not business content, and are called out
// here rather than silently invented.

export type EmailLanguage = 'en' | 'ar'

interface EmailStringSet {
  /** Text wordmark used in the header — no logo image exists in the app (NavBar/Footer render a styled text wordmark), so the email header mirrors that. */
  brandName: string
  reference: string
  vehicle: string
  rentalDates: string
  pickup: string
  dropoff: string
  amount: string
  amountDue: string
  paymentStatus: string
  bookingStatus: string
  viewBooking: string
  manageBooking: string
  automatedNotice: string
  supportIntro: string
  whatsappLabel: string
  emailLabel: string
  officeLabel: string
  hoursLabel: string
  footerRights: string
  /** Admin-only chrome — new for Phase 9, no prior app copy to reuse. */
  admin: {
    openDashboard: string
    priority: string
    requiredAction: string
    customer: string
    booking: string
  }
}

export const EMAIL_STRINGS: Record<EmailLanguage, EmailStringSet> = {
  en: {
    brandName: 'Bliss Rent',
    reference: 'Reference',
    vehicle: 'Vehicle',
    rentalDates: 'Rental dates',
    pickup: 'Pickup',
    dropoff: 'Drop-off',
    amount: 'Amount',
    amountDue: 'Amount due',
    paymentStatus: 'Payment status',
    bookingStatus: 'Booking status',
    viewBooking: 'View booking',
    manageBooking: 'Manage your booking',
    automatedNotice: 'This is an automated message from Bliss Rent — please do not reply directly to this email.',
    supportIntro: 'Questions about this booking? Here is how to reach Bliss Rent.',
    whatsappLabel: 'WhatsApp support',
    emailLabel: 'Email',
    officeLabel: 'Office',
    hoursLabel: 'Support hours',
    footerRights: 'All rights reserved.',
    admin: {
      openDashboard: 'Open Admin Dashboard',
      priority: 'Priority',
      requiredAction: 'Required action',
      customer: 'Customer',
      booking: 'Booking',
    },
  },
  ar: {
    brandName: 'بليس رنت',
    reference: 'رقم الحجز',
    vehicle: 'السيارة',
    rentalDates: 'تواريخ الإيجار',
    pickup: 'الاستلام',
    dropoff: 'التسليم',
    amount: 'المبلغ',
    amountDue: 'المبلغ المستحق',
    paymentStatus: 'حالة الدفع',
    bookingStatus: 'حالة الحجز',
    viewBooking: 'عرض الحجز',
    manageBooking: 'إدارة حجزك',
    automatedNotice: 'هذه رسالة تلقائية من بليس رنت — يرجى عدم الرد مباشرة على هذا البريد الإلكتروني.',
    supportIntro: 'لديك سؤال حول هذا الحجز؟ إليك طرق التواصل مع بليس رنت.',
    whatsappLabel: 'دعم واتساب',
    emailLabel: 'البريد الإلكتروني',
    officeLabel: 'المكتب',
    hoursLabel: 'ساعات الدعم',
    footerRights: 'جميع الحقوق محفوظة.',
    admin: {
      openDashboard: 'فتح لوحة تحكم الإدارة',
      priority: 'الأولوية',
      requiredAction: 'الإجراء المطلوب',
      customer: 'العميل',
      booking: 'الحجز',
    },
  },
}
