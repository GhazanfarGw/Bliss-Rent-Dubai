// Phase 9D — send-customer-email Edge Function logic.
//
// Admin-triggered customer email sends. Today this is called from
// exactly one place: adminBookingsApi.ts's updateBookingStatus(), right
// after a cancellation succeeds (see that file's comment for why
// cancellation — unlike booking creation/payment confirmation — has no
// existing Edge Function hook to piggyback on). Built generically enough
// that any future admin-triggered customer email reuses this same
// function rather than each needing its own Edge Function.
//
// Requires an authenticated, active admin caller — same
// getCallerUserId/getCallerProfile dependency-injection shape as
// admin-create-staff/logic.ts, so this file stays Vitest-testable
// exactly like every other Edge Function's logic.ts.
import { fetchBookingEmailRow, buildBookingSummaryFromRow, type BookingEmailDataSource, BookingEmailDataError } from '../_shared/email/bookingEmailData.ts'
import { resolveCustomerRecipient, MissingRecipientError } from '../_shared/email/recipient.ts'
import {
  sendCustomerBookingEmailIdempotently,
  type EmailLogStore,
  type SendCustomerEmailFn,
} from '../_shared/email/sendCustomerBookingEmail.ts'
import type { CustomerBookingEventType } from '../_shared/email/customerEmailContent.ts'
import type { ResendConfig } from '../_shared/email/resendProvider.ts'
import type { EmailLanguage } from '../_shared/email/strings.ts'

const ALLOWED_EVENT_TYPES: CustomerBookingEventType[] = [
  'booking_received',
  'booking_confirmed',
  'payment_failed',
  'booking_cancelled',
]

export type SendCustomerEmailErrorCode = 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'BOOKING_NOT_FOUND' | 'SERVER_ERROR'

export class SendCustomerEmailError extends Error {
  code: SendCustomerEmailErrorCode
  httpStatus: number
  fieldErrors?: Record<string, string>

  constructor(code: SendCustomerEmailErrorCode, message: string, httpStatus: number, fieldErrors?: Record<string, string>) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
    this.fieldErrors = fieldErrors
  }
}

export interface SendCustomerEmailRequestBody {
  bookingId?: string
  eventType?: string
  language?: string
  /** Only meaningful for a repeatable event type — see sendCustomerBookingEmail.ts. Unused by every event type today. */
  triggeringRowId?: string
}

export interface CallerProfile {
  role: string
  is_active: boolean
}

export interface SendCustomerEmailDeps {
  getCallerUserId(accessToken: string): Promise<string | null>
  getCallerProfile(id: string): Promise<CallerProfile | null>
  dataSource: BookingEmailDataSource
  emailLog: EmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  /** Injectable for tests; defaults to the real Resend call inside sendCustomerBookingEmailIdempotently. */
  sendEmail?: SendCustomerEmailFn
}

export interface SendCustomerEmailResult {
  status: 'sent' | 'skipped_duplicate' | 'send_failed'
  emailLogId?: string
  /** Only present when status is 'send_failed' — surfaced so the calling admin action can show why. */
  errorMessage?: string
}

export async function handleSendCustomerEmail(
  authHeader: string | null,
  body: SendCustomerEmailRequestBody,
  deps: SendCustomerEmailDeps,
): Promise<SendCustomerEmailResult> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw new SendCustomerEmailError('UNAUTHORIZED', 'You must be signed in to do that.', 401)
  }

  const callerId = await deps.getCallerUserId(token)
  if (!callerId) {
    throw new SendCustomerEmailError('UNAUTHORIZED', 'Your session has expired. Please sign in again.', 401)
  }

  const callerProfile = await deps.getCallerProfile(callerId)
  if (!callerProfile || !['staff', 'super_admin'].includes(callerProfile.role) || !callerProfile.is_active) {
    throw new SendCustomerEmailError('FORBIDDEN', 'Only an active admin can trigger a customer email.', 403)
  }

  if (!body.bookingId || typeof body.bookingId !== 'string') {
    throw new SendCustomerEmailError('VALIDATION_ERROR', 'bookingId is required.', 422, { bookingId: 'bookingId is required.' })
  }
  if (!body.eventType || !ALLOWED_EVENT_TYPES.includes(body.eventType as CustomerBookingEventType)) {
    throw new SendCustomerEmailError(
      'VALIDATION_ERROR',
      `eventType must be one of: ${ALLOWED_EVENT_TYPES.join(', ')}.`,
      422,
      { eventType: 'A valid eventType is required.' },
    )
  }

  const language: EmailLanguage = body.language === 'ar' ? 'ar' : 'en'

  let row
  try {
    row = await fetchBookingEmailRow(deps.dataSource, body.bookingId)
  } catch (err) {
    if (err instanceof BookingEmailDataError) {
      throw new SendCustomerEmailError('BOOKING_NOT_FOUND', 'That booking could not be found.', 404)
    }
    throw err
  }

  let recipient
  try {
    recipient = resolveCustomerRecipient(row.customers)
  } catch (err) {
    if (err instanceof MissingRecipientError) {
      throw new SendCustomerEmailError('SERVER_ERROR', 'This booking has no customer email on file to send to.', 500)
    }
    throw err
  }

  const summary = buildBookingSummaryFromRow(row)

  const outcome = await sendCustomerBookingEmailIdempotently(
    { emailLog: deps.emailLog, resendConfig: deps.resendConfig, sendEmail: deps.sendEmail },
    {
      eventType: body.eventType as CustomerBookingEventType,
      bookingId: row.id,
      bookingReference: summary.reference,
      recipient,
      summary,
      language,
      siteBaseUrl: deps.siteBaseUrl,
      triggeringRowId: body.triggeringRowId,
    },
  )

  if (outcome.status === 'skipped_duplicate') {
    return { status: 'skipped_duplicate' }
  }
  if (outcome.status === 'send_failed') {
    return { status: 'send_failed', emailLogId: outcome.emailLogId, errorMessage: outcome.errorMessage }
  }
  return { status: outcome.status, emailLogId: outcome.emailLogId }
}
