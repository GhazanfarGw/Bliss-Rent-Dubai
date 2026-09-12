// Phase 9F — notify-admin-booking-cancelled Edge Function logic.
//
// Admin-triggered, exactly like send-customer-email (Phase 9D) and
// deliver-extension-notifications (Phase 9E): booking cancellation has
// no in-process hook the way booking creation / payment confirmation /
// extension submission do — adminBookingsApi.ts's updateBookingStatus()
// is a plain RLS-governed UPDATE from the browser, not an Edge Function
// call, so there is nowhere to fire an in-process admin-email trigger
// the way create-booking/confirm-payment/submit-extension-request's
// index.ts files do. This function is the minimal, narrowly-scoped hook
// point instead — the frontend calls it, best-effort, right after the
// cancellation UPDATE succeeds, passing only the bookingId it already
// has in hand.
//
// Deliberately single-purpose (one hardcoded event type), not a generic
// "send any admin event" endpoint: the other 4 admin operational events
// all already have a real in-process hook and never need a frontend
// call at all. Widening this into a general-purpose endpoint before a
// second frontend-triggered event actually exists would be exactly the
// kind of workflow invention the 9F instruction warns against.
//
// Requires an authenticated, active admin caller — identical
// getCallerUserId/getCallerProfile shape as every other admin-triggered
// function in this codebase.
import { deliverAdminOperationalEmails, type DeliverAdminOperationalEmailsDataSource, type DeliveredAdminEmailOutcome } from '../_shared/email/deliverAdminOperationalEmails.ts'
import { BookingEmailDataError } from '../_shared/email/bookingEmailData.ts'
import type { AdminEmailLogStore, SendAdminEmailFn } from '../_shared/email/sendAdminOperationalEmail.ts'
import type { GetAdminEmailFn } from '../_shared/email/adminRecipients.ts'
import type { ResendConfig } from '../_shared/email/resendProvider.ts'

export type NotifyAdminBookingCancelledErrorCode = 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'BOOKING_NOT_FOUND' | 'SERVER_ERROR'

export class NotifyAdminBookingCancelledError extends Error {
  code: NotifyAdminBookingCancelledErrorCode
  httpStatus: number
  fieldErrors?: Record<string, string>

  constructor(code: NotifyAdminBookingCancelledErrorCode, message: string, httpStatus: number, fieldErrors?: Record<string, string>) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
    this.fieldErrors = fieldErrors
  }
}

export interface NotifyAdminBookingCancelledRequestBody {
  bookingId?: string
}

export interface CallerProfile {
  role: string
  is_active: boolean
}

export interface NotifyAdminBookingCancelledDeps {
  getCallerUserId(accessToken: string): Promise<string | null>
  getCallerProfile(id: string): Promise<CallerProfile | null>
  dataSource: DeliverAdminOperationalEmailsDataSource
  getAdminEmail: GetAdminEmailFn
  emailLog: AdminEmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendAdminEmailFn
}

export interface NotifyAdminBookingCancelledResult {
  outcomes: DeliveredAdminEmailOutcome[]
}

export async function handleNotifyAdminBookingCancelled(
  authHeader: string | null,
  body: NotifyAdminBookingCancelledRequestBody,
  deps: NotifyAdminBookingCancelledDeps,
): Promise<NotifyAdminBookingCancelledResult> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw new NotifyAdminBookingCancelledError('UNAUTHORIZED', 'You must be signed in to do that.', 401)
  }

  const callerId = await deps.getCallerUserId(token)
  if (!callerId) {
    throw new NotifyAdminBookingCancelledError('UNAUTHORIZED', 'Your session has expired. Please sign in again.', 401)
  }

  const callerProfile = await deps.getCallerProfile(callerId)
  if (!callerProfile || !['staff', 'super_admin'].includes(callerProfile.role) || !callerProfile.is_active) {
    throw new NotifyAdminBookingCancelledError('FORBIDDEN', 'Only an active admin can trigger an admin notification email.', 403)
  }

  if (!body.bookingId || typeof body.bookingId !== 'string') {
    throw new NotifyAdminBookingCancelledError('VALIDATION_ERROR', 'bookingId is required.', 422, { bookingId: 'bookingId is required.' })
  }

  let outcomes: DeliveredAdminEmailOutcome[]
  try {
    outcomes = await deliverAdminOperationalEmails(
      {
        dataSource: deps.dataSource,
        getAdminEmail: deps.getAdminEmail,
        emailLog: deps.emailLog,
        resendConfig: deps.resendConfig,
        siteBaseUrl: deps.siteBaseUrl,
        sendEmail: deps.sendEmail,
      },
      {
        bookingId: body.bookingId,
        eventType: 'admin_booking_cancelled',
        // English only — see adminRecipients.ts / the completion report:
        // there is no stored per-admin language preference any more than
        // there is a per-customer one (9E's same flagged limitation).
        language: 'en',
        dashboardPath: `/admin/bookings/${body.bookingId}`,
      },
    )
  } catch (err) {
    if (err instanceof BookingEmailDataError) {
      throw new NotifyAdminBookingCancelledError('BOOKING_NOT_FOUND', 'That booking could not be found.', 404)
    }
    throw err
  }

  return { outcomes }
}
