export type EmailLanguage = 'en' | 'ar'

interface EmailStringSet {
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
    admin: { openDashboard: 'Open Admin Dashboard', priority: 'Priority', requiredAction: 'Required action', customer: 'Customer', booking: 'Booking' },
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
    admin: { openDashboard: 'فتح لوحة تحكم الإدارة', priority: 'الأولوية', requiredAction: 'الإجراء المطلوب', customer: 'العميل', booking: 'الحجز' },
  },
}
