// Phase 9H — EN/AR content for the one admin event this phase adds:
// a Contact Us message reaching the (previously non-functional) complaint
// pipeline. Deliberately its own small content file rather than folded
// into adminOperationalEmailContent.ts's `AdminOperationalEventType` union
// — that type's whole pipeline (deliverAdminOperationalEmails.ts) requires
// a real booking id to fetch a BookingSummary from, and a Contact Us
// message may have no booking at all (see the migration comment in
// 20260913000000_phase9h_submit_complaint.sql). Kept parallel, exactly
// the same reasoning 9E/9F already applied to their own content files.

import type { AdminPriority } from './types.ts'
import type { EmailLanguage } from './strings.ts'

export interface ComplaintNotificationContent {
  subject: string
  alertType: string
  priority: AdminPriority
  requiredAction: string
}

const CONTENT: Record<EmailLanguage, ComplaintNotificationContent> = {
  en: {
    subject: 'New message from Contact Us',
    alertType: 'New message received',
    priority: 'attention',
    requiredAction: 'Review this message and respond to the customer.',
  },
  ar: {
    subject: 'رسالة جديدة من صفحة تواصل معنا',
    alertType: 'تم استلام رسالة جديدة',
    priority: 'attention',
    requiredAction: 'يرجى مراجعة هذه الرسالة والرد على العميل.',
  },
}

export function getComplaintNotificationContent(language: EmailLanguage): ComplaintNotificationContent {
  return CONTENT[language]
}
