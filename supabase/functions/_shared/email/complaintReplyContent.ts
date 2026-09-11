// Task 3 (2026-09-11 scoped update) — EN/AR content for the one new
// customer-facing event this task adds: an admin's reply to a Contact Us
// message (`admin_complaint_reply`). Kept as its own small content file,
// same reasoning Phase 9H already applied to complaintNotificationContent.ts
// (the admin-notification direction) — this is the reverse direction
// (admin -> customer) and has no existing content to fold into.

import type { EmailLanguage } from './strings.ts'

export interface ComplaintReplyContent {
  subject: string
  title: string
  message: string
  statusMessage: string
  yourMessageLabel: string
  ourReplyLabel: string
  ctaLabel: string
}

const CONTENT: Record<EmailLanguage, ComplaintReplyContent> = {
  en: {
    subject: 'Bliss Rent replied to your message',
    title: 'We replied to your message',
    message: 'Thank you for contacting Bliss Rent. Our team has responded to the message you sent us — see the reply below.',
    statusMessage: 'Your message has received a reply',
    yourMessageLabel: 'Your message',
    ourReplyLabel: 'Our reply',
    ctaLabel: 'Visit Bliss Rent',
  },
  ar: {
    subject: 'رد بليس رنت على رسالتك',
    title: 'لقد رددنا على رسالتك',
    message: 'شكراً لتواصلك مع بليس رنت. قام فريقنا بالرد على الرسالة التي أرسلتها إلينا — انظر الرد أدناه.',
    statusMessage: 'تم الرد على رسالتك',
    yourMessageLabel: 'رسالتك',
    ourReplyLabel: 'ردنا',
    ctaLabel: 'زيارة بليس رنت',
  },
}

export function getComplaintReplyContent(language: EmailLanguage): ComplaintReplyContent {
  return CONTENT[language]
}
