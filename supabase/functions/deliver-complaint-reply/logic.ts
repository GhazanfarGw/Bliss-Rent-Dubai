// Task 3 (2026-09-11 scoped update) — deliver-complaint-reply Edge
// Function logic. Admin-triggered, exactly like
// deliver-plate-confirmation-notifications: the admin dashboard
// (ComplaintDetailPage) saves the reply text directly to `complaints`
// (RLS-governed, "admins manage complaints" already covers it — see the
// 20261005000000 migration), then best-effort calls this function with
// only the complaintId. Every other field — the reply text, the
// customer's email, the idempotency discriminator — is read back from
// the database here, never trusted from the request body.
import { fetchComplaintReplyRow, type ComplaintReplyDataSource } from '../_shared/email/complaintReplyData.ts'
import { resolveCustomerRecipient } from '../_shared/email/recipient.ts'
import { sendComplaintReplyEmailIdempotently, type ComplaintReplySendOutcome, type ComplaintReplyEmailLogStore, type SendComplaintReplyEmailFn } from '../_shared/email/sendComplaintReplyEmail.ts'
import type { ResendConfig } from '../_shared/email/resendProvider.ts'
import type { EmailLanguage } from '../_shared/email/strings.ts'

export type DeliverComplaintReplyErrorCode = 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'SERVER_ERROR'

export class DeliverComplaintReplyError extends Error {
  code: DeliverComplaintReplyErrorCode
  httpStatus: number
  fieldErrors?: Record<string, string>

  constructor(code: DeliverComplaintReplyErrorCode, message: string, httpStatus: number, fieldErrors?: Record<string, string>) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
    this.fieldErrors = fieldErrors
  }
}

export interface DeliverComplaintReplyRequestBody {
  complaintId?: string
  /** Same admin-triggered convention as deliver-plate-confirmation-notifications: no stored per-customer language preference exists, so this defaults to 'en' unless the caller explicitly passes 'ar'. */
  language?: string
}

export interface CallerProfile {
  role: string
  is_active: boolean
}

export interface DeliverComplaintReplyDeps {
  getCallerUserId(accessToken: string): Promise<string | null>
  getCallerProfile(id: string): Promise<CallerProfile | null>
  dataSource: ComplaintReplyDataSource
  emailLog: ComplaintReplyEmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendComplaintReplyEmailFn
}

export interface DeliverComplaintReplyResult {
  outcome: ComplaintReplySendOutcome | { status: 'skipped_no_reply' } | { status: 'skipped_no_recipient'; errorMessage: string }
}

export async function handleDeliverComplaintReply(
  authHeader: string | null,
  body: DeliverComplaintReplyRequestBody,
  deps: DeliverComplaintReplyDeps,
): Promise<DeliverComplaintReplyResult> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw new DeliverComplaintReplyError('UNAUTHORIZED', 'You must be signed in to do that.', 401)
  }

  const callerId = await deps.getCallerUserId(token)
  if (!callerId) {
    throw new DeliverComplaintReplyError('UNAUTHORIZED', 'Your session has expired. Please sign in again.', 401)
  }

  const callerProfile = await deps.getCallerProfile(callerId)
  if (!callerProfile || !['staff', 'super_admin'].includes(callerProfile.role) || !callerProfile.is_active) {
    throw new DeliverComplaintReplyError('FORBIDDEN', 'Only an active admin can send a complaint reply.', 403)
  }

  if (!body.complaintId || typeof body.complaintId !== 'string') {
    throw new DeliverComplaintReplyError('VALIDATION_ERROR', 'complaintId is required.', 422, { complaintId: 'complaintId is required.' })
  }

  const language: EmailLanguage = body.language === 'ar' ? 'ar' : 'en'

  const row = await fetchComplaintReplyRow(deps.dataSource, body.complaintId)

  // Nothing to send — either no reply has been saved yet, or this is a
  // stale/duplicate trigger. Never an error: the caller (adminComplaintsApi's
  // best-effort invoke) treats this the same as any other skipped outcome.
  if (!row.admin_reply_message || !row.admin_reply_sent_at) {
    return { outcome: { status: 'skipped_no_reply' } }
  }

  try {
    const recipient = resolveCustomerRecipient(row.customers)
    const outcome = await sendComplaintReplyEmailIdempotently(
      { emailLog: deps.emailLog, resendConfig: deps.resendConfig, sendEmail: deps.sendEmail },
      {
        complaintId: row.id,
        bookingId: row.booking_id,
        recipient,
        originalSubject: row.subject,
        originalMessage: row.description,
        replyMessage: row.admin_reply_message,
        replySentAt: row.admin_reply_sent_at,
        language,
        siteBaseUrl: deps.siteBaseUrl,
      },
    )
    return { outcome }
  } catch (err) {
    // Isolation guarantee — same as deliverPlateConfirmedNotificationEmail.ts:
    // a missing/invalid customer email can never turn an already-saved
    // reply into a thrown error for the admin who triggered this.
    return { outcome: { status: 'skipped_no_recipient', errorMessage: err instanceof Error ? err.message : String(err) } }
  }
}
