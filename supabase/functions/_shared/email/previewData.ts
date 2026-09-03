// Realistic FAKE QA data for previewing the base templates — never used
// by any real send path. No real customer, booking, or contact
// information appears here; names/plates/references below are made up
// for template QA only, matching the shape real data will have (e.g.
// the BLS-XXXXXXXX reference format from src/lib/bookingReference.ts).

import { buildManageBookingUrl } from './manageBookingLink.ts'
import type { BookingSummary, CustomerEmailProps, AdminEmailProps } from './types.ts'

const QA_SITE_BASE_URL = 'https://bliss.rent'

export const QA_SUMMARY_EN: BookingSummary = {
  reference: 'BLS-7F3A9C21',
  vehicleName: 'Toyota Camry 2026 (or similar)',
  rentalDatesLabel: '10 Sep 2026 – 15 Sep 2026',
  pickupLabel: 'Dubai International Airport (DXB)',
  dropoffLabel: 'Dubai International Airport (DXB)',
  amountLabel: 'AED 750.00',
  paymentStatusLabel: 'Paid',
  bookingStatusLabel: 'Confirmed',
}

export const QA_SUMMARY_AR: BookingSummary = {
  ...QA_SUMMARY_EN,
  vehicleName: 'تويوتا كامري 2026 (أو ما يعادلها)',
  rentalDatesLabel: '10 سبتمبر 2026 – 15 سبتمبر 2026',
  pickupLabel: 'مطار دبي الدولي (DXB)',
  dropoffLabel: 'مطار دبي الدولي (DXB)',
  paymentStatusLabel: 'مدفوع',
  bookingStatusLabel: 'مؤكد',
}

export function qaCustomerProps(language: 'en' | 'ar'): CustomerEmailProps {
  const summary = language === 'ar' ? QA_SUMMARY_AR : QA_SUMMARY_EN
  return {
    language,
    title: language === 'ar' ? 'تم تأكيد الحجز' : 'Booking confirmed',
    message:
      language === 'ar'
        ? 'شكراً لحجزك مع بليس رنت. فيما يلي تفاصيل حجزك.'
        : 'Thank you for booking with Bliss Rent. Here are your booking details.',
    statusTone: 'success',
    statusMessage: language === 'ar' ? 'تم تأكيد الدفع والحجز' : 'Payment and booking confirmed',
    summary,
    ctaUrl: buildManageBookingUrl(QA_SITE_BASE_URL, summary.reference),
  }
}

export function qaAdminProps(language: 'en' | 'ar'): AdminEmailProps {
  const summary = language === 'ar' ? QA_SUMMARY_AR : QA_SUMMARY_EN
  return {
    language,
    alertType: language === 'ar' ? 'حجز جديد تم استلامه' : 'New booking received',
    priority: 'normal',
    summary,
    customerName: language === 'ar' ? 'محمد أحمد (بيانات تجريبية)' : 'Jane Renter (QA data)',
    dashboardUrl: `${QA_SITE_BASE_URL}/admin/bookings`,
  }
}
