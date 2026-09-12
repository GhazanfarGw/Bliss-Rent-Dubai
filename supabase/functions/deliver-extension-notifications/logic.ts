// Phase 9E — deliver-extension-notifications Edge Function logic.
//
// Admin-triggered, exactly like send-customer-email (Phase 9D): none of
// request_booking_extension()/confirm_booking_extension_payment()/
// reject_extension_request() are called through an Edge Function today
// (adminExtensionsApi.ts calls each directly via supabase.rpc()), so
// there is no existing HTTP hook to attach an in-process email trigger to
// the way create-booking/confirm-payment have. This function is the
// minimal, narrowly-scoped hook point instead: the frontend calls it,
// best-effort, right after any of those three RPCs succeeds, passing only
// the extensionId it already has in hand — every other fact (which
// booking(s), which notifications, who to email) is resolved server-side
// from data those unmodified SQL functions already wrote.
//
// Requires an authenticated, active admin caller — identical
// getCallerUserId/getCallerProfile shape to every other admin-triggered
// function in this codebase, so this file stays Vitest-testable the same
// way.
import { deliverExtensionNotificationEmails, type DeliverExtensionNotificationsDataSource, type DeliveredNotificationOutcome } from '../_shared/email/deliverExtensionNotifications.ts'
import { ExtensionNotFoundError } from '../_shared/email/extensionNotificationData.ts'
import type { EmailLogStore } from '../_shared/email/sendCustomerBookingEmail.ts'
import type { ResendConfig } from '../_shared/email/resendProvider.ts'
import type { EmailLanguage } from '../_shared/email/strings.ts'
import type { SendCustomerEmailFn } from '../_shared/email/sendCustomerBookingEmail.ts'

export type DeliverExtensionNotificationsErrorCode = 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'EXTENSION_NOT_FOUND' | 'SERVER_ERROR'

export class DeliverExtensionNotificationsError extends Error {
  code: DeliverExtensionNotificationsErrorCode
  httpStatus: number
  fieldErrors?: Record<string, string>

  constructor(code: DeliverExtensionNotificationsErrorCode, message: string, httpStatus: number, fieldErrors?: Record<string, string>) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
    this.fieldErrors = fieldErrors
  }
}

export interface DeliverExtensionNotificationsRequestBody {
  extensionId?: string
  /** No stored per-customer language preference exists today (see deliverExtensionNotifications.ts) — this is accepted for forward-compatibility only; every real caller omits it and gets 'en'. */
  language?: string
}

export interface CallerProfile {
  role: string
  is_active: boolean
}

export interface DeliverExtensionNotificationsDeps {
  getCallerUserId(accessToken: string): Promise<string | null>
  getCallerProfile(id: string): Promise<CallerProfile | null>
  dataSource: DeliverExtensionNotificationsDataSource
  emailLog: EmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendCustomerEmailFn
}

export interface DeliverExtensionNotificationsResult {
  outcomes: DeliveredNotificationOutcome[]
}

export async function handleDeliverExtensionNotifications(
  authHeader: string | null,
  body: DeliverExtensionNotificationsRequestBody,
  deps: DeliverExtensionNotificationsDeps,
): Promise<DeliverExtensionNotificationsResult> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw new DeliverExtensionNotificationsError('UNAUTHORIZED', 'You must be signed in to do that.', 401)
  }

  const callerId = await deps.getCallerUserId(token)
  if (!callerId) {
    throw new DeliverExtensionNotificationsError('UNAUTHORIZED', 'Your session has expired. Please sign in again.', 401)
  }

  const callerProfile = await deps.getCallerProfile(callerId)
  if (!callerProfile || !['staff', 'super_admin'].includes(callerProfile.role) || !callerProfile.is_active) {
    throw new DeliverExtensionNotificationsError('FORBIDDEN', 'Only an active admin can trigger extension notification emails.', 403)
  }

  if (!body.extensionId || typeof body.extensionId !== 'string') {
    throw new DeliverExtensionNotificationsError('VALIDATION_ERROR', 'extensionId is required.', 422, { extensionId: 'extensionId is required.' })
  }

  const language: EmailLanguage = body.language === 'ar' ? 'ar' : 'en'

  let outcomes: DeliveredNotificationOutcome[]
  try {
    outcomes = await deliverExtensionNotificationEmails(
      { dataSource: deps.dataSource, emailLog: deps.emailLog, resendConfig: deps.resendConfig, siteBaseUrl: deps.siteBaseUrl, sendEmail: deps.sendEmail },
      body.extensionId,
      language,
    )
  } catch (err) {
    if (err instanceof ExtensionNotFoundError) {
      throw new DeliverExtensionNotificationsError('EXTENSION_NOT_FOUND', 'That extension could not be found.', 404)
    }
    throw err
  }

  return { outcomes }
}
