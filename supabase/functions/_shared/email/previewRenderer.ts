// Phase 9I — renders any real template with 9B's existing fake QA data
// (previewData.ts), for the admin preview/test-send tool. Never touches
// email_log, never resolves a real recipient, never reads a real booking
// — every render here is built entirely from already-existing, already-
// fake data and already-shipped content files (9D/9F/9H). No new content
// or business copy is introduced.
//
// Deliberately does NOT (yet) cover 9E's 4 extension/reassignment
// templates — those need payload-shaped fake data (a rejection reason, a
// reassigned plate number), not just a BookingSummary, and are left out
// of this first preview-tool pass rather than faking payload data that
// could be mistaken for a real business scenario. Documented in the
// Phase 9I completion report, not silently dropped.

import { getCustomerEmailContent, type CustomerBookingEventType } from './customerEmailContent.ts'
import { getAdminOperationalEmailContent, type AdminOperationalEventType, ADMIN_OPERATIONAL_EVENT_TYPES } from './adminOperationalEmailContent.ts'
import { getComplaintNotificationContent } from './complaintNotificationContent.ts'
import { renderCustomerLayout, renderAdminLayout } from './layout.ts'
import { renderDetailsCard } from './components.ts'
import { QA_SUMMARY_EN, QA_SUMMARY_AR } from './previewData.ts'
import { buildManageBookingUrl } from './manageBookingLink.ts'
import { buildAdminDashboardUrl } from './adminDashboardLink.ts'
import type { EmailLanguage } from './strings.ts'

const QA_SITE_BASE_URL = 'https://bliss.rent'
const QA_CUSTOMER_NAME_EN = 'Jane Renter (QA data)'
const QA_CUSTOMER_NAME_AR = 'محمد أحمد (بيانات تجريبية)'

export const CUSTOMER_EVENT_TYPES: CustomerBookingEventType[] = [
  'booking_received',
  'booking_confirmed',
  'payment_failed',
  'booking_cancelled',
  'pickup_reminder',
  'return_reminder',
]

export type PreviewCategory = 'customer' | 'admin' | 'complaint'

export interface PreviewCatalogEntry {
  category: PreviewCategory
  eventType: string
  label: string
}

/** Every template this tool can currently render — for a preview UI's dropdown/list. */
export function listPreviewCatalog(): PreviewCatalogEntry[] {
  return [
    ...CUSTOMER_EVENT_TYPES.map((eventType) => ({ category: 'customer' as const, eventType, label: eventType })),
    ...ADMIN_OPERATIONAL_EVENT_TYPES.map((eventType) => ({ category: 'admin' as const, eventType, label: eventType })),
    { category: 'complaint' as const, eventType: 'admin_complaint_received', label: 'admin_complaint_received' },
  ]
}

function qaSummary(language: EmailLanguage) {
  return language === 'ar' ? QA_SUMMARY_AR : QA_SUMMARY_EN
}

export function renderCustomerEventPreview(eventType: CustomerBookingEventType, language: EmailLanguage): string {
  const content = getCustomerEmailContent(eventType, language)
  const summary = qaSummary(language)
  const ctaUrl = buildManageBookingUrl(QA_SITE_BASE_URL, summary.reference)
  return renderCustomerLayout({
    language,
    title: content.title,
    message: content.message,
    statusTone: content.statusTone,
    statusMessage: content.statusMessage,
    summary,
    ctaUrl,
  })
}

export function renderAdminEventPreview(eventType: AdminOperationalEventType, language: EmailLanguage): string {
  const content = getAdminOperationalEmailContent(eventType, language)
  const summary = qaSummary(language)
  const dashboardUrl = buildAdminDashboardUrl(QA_SITE_BASE_URL, '/admin/bookings')
  return renderAdminLayout({
    language,
    alertType: content.alertType,
    priority: content.priority,
    summary,
    customerName: language === 'ar' ? QA_CUSTOMER_NAME_AR : QA_CUSTOMER_NAME_EN,
    requiredAction: content.requiredAction,
    dashboardUrl,
  })
}

export function renderComplaintEventPreview(language: EmailLanguage): string {
  const content = getComplaintNotificationContent(language)
  const dashboardUrl = buildAdminDashboardUrl(QA_SITE_BASE_URL, '/admin/complaints')
  const labels =
    language === 'ar'
      ? { subject: 'الموضوع', message: 'الرسالة', replyTo: 'الرد على' }
      : { subject: 'Subject', message: 'Message', replyTo: 'Reply-to' }
  const detailsHtml = renderDetailsCard(
    [
      { label: labels.subject, value: language === 'ar' ? 'استرداد متأخر (بيانات تجريبية)' : 'Late refund (QA data)' },
      {
        label: labels.message,
        value:
          language === 'ar'
            ? 'لم يصلني المبلغ المسترد بعد. (بيانات تجريبية)'
            : 'My refund has not arrived yet. (QA data)',
      },
      { label: labels.replyTo, value: 'jane@example.com', ltrValue: true },
    ],
    language,
  )
  return renderAdminLayout({
    language,
    alertType: content.alertType,
    priority: content.priority,
    customerName: language === 'ar' ? QA_CUSTOMER_NAME_AR : QA_CUSTOMER_NAME_EN,
    requiredAction: content.requiredAction,
    detailsHtml,
    dashboardUrl,
  })
}

export class UnknownPreviewTemplateError extends Error {}

/** One dispatch point for the Edge Function — resolves (category, eventType) to rendered HTML, or throws for an unrecognized pair. */
export function renderPreview(category: PreviewCategory, eventType: string, language: EmailLanguage): string {
  if (category === 'customer') {
    if (!CUSTOMER_EVENT_TYPES.includes(eventType as CustomerBookingEventType)) {
      throw new UnknownPreviewTemplateError(`Unknown customer event type: ${eventType}`)
    }
    return renderCustomerEventPreview(eventType as CustomerBookingEventType, language)
  }
  if (category === 'admin') {
    if (!ADMIN_OPERATIONAL_EVENT_TYPES.includes(eventType as AdminOperationalEventType)) {
      throw new UnknownPreviewTemplateError(`Unknown admin event type: ${eventType}`)
    }
    return renderAdminEventPreview(eventType as AdminOperationalEventType, language)
  }
  if (category === 'complaint') {
    return renderComplaintEventPreview(language)
  }
  throw new UnknownPreviewTemplateError(`Unknown preview category: ${category}`)
}
