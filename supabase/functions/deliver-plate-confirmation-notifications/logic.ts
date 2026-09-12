// Phase 14 — deliver-plate-confirmation-notifications Edge Function logic.
//
// Admin-triggered, exactly like deliver-extension-notifications: the
// frontend calls this best-effort right after admin_confirm_booking_vehicle()
// succeeds, passing only the bookingId it already has in hand. Delivers
// the booking's `plate_confirmed` email (via
// deliverPlateConfirmedNotificationEmail.ts) AND attempts the WhatsApp
// dispatch (via dispatchPlateConfirmedWhatsapp.ts) for the same
// notification row — the latter safely resolves to 'not_configured' today
// since no WhatsApp provider exists in this codebase (see that file's own
// header), never inventing a vendor.
import { deliverPlateConfirmedNotificationEmail, type DeliverPlateConfirmedNotificationDataSource, type DeliveredPlateConfirmedOutcome } from '../_shared/email/deliverPlateConfirmedNotificationEmail.ts'
import { dispatchPlateConfirmedWhatsapp, type WhatsappNotificationSource, type PlateConfirmedWhatsappOutcome } from '../_shared/whatsapp/dispatchPlateConfirmedWhatsapp.ts'
import type { EmailLogStore, SendCustomerEmailFn } from '../_shared/email/sendCustomerBookingEmail.ts'
import type { ResendConfig } from '../_shared/email/resendProvider.ts'
import type { EmailLanguage } from '../_shared/email/strings.ts'

export type DeliverPlateConfirmationNotificationsErrorCode = 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'SERVER_ERROR'

export class DeliverPlateConfirmationNotificationsError extends Error {
  code: DeliverPlateConfirmationNotificationsErrorCode
  httpStatus: number
  fieldErrors?: Record<string, string>

  constructor(code: DeliverPlateConfirmationNotificationsErrorCode, message: string, httpStatus: number, fieldErrors?: Record<string, string>) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
    this.fieldErrors = fieldErrors
  }
}

export interface DeliverPlateConfirmationNotificationsRequestBody {
  bookingId?: string
  /** Same admin-triggered convention as deliver-extension-notifications: no stored per-customer language preference exists, so this defaults to 'en' unless the caller explicitly passes 'ar'. */
  language?: string
}

export interface CallerProfile {
  role: string
  is_active: boolean
}

export interface DeliverPlateConfirmationNotificationsDeps {
  getCallerUserId(accessToken: string): Promise<string | null>
  getCallerProfile(id: string): Promise<CallerProfile | null>
  dataSource: DeliverPlateConfirmedNotificationDataSource
  whatsappSource: WhatsappNotificationSource
  getEnv(name: string): string | undefined
  emailLog: EmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  /** Injectable for tests; defaults to the real Resend call. */
  sendEmail?: SendCustomerEmailFn
}

export interface DeliverPlateConfirmationNotificationsResult {
  emailOutcomes: DeliveredPlateConfirmedOutcome[]
  whatsappOutcomes: { notificationId: string; outcome: PlateConfirmedWhatsappOutcome }[]
}

export async function handleDeliverPlateConfirmationNotifications(
  authHeader: string | null,
  body: DeliverPlateConfirmationNotificationsRequestBody,
  deps: DeliverPlateConfirmationNotificationsDeps,
): Promise<DeliverPlateConfirmationNotificationsResult> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw new DeliverPlateConfirmationNotificationsError('UNAUTHORIZED', 'You must be signed in to do that.', 401)
  }

  const callerId = await deps.getCallerUserId(token)
  if (!callerId) {
    throw new DeliverPlateConfirmationNotificationsError('UNAUTHORIZED', 'Your session has expired. Please sign in again.', 401)
  }

  const callerProfile = await deps.getCallerProfile(callerId)
  if (!callerProfile || !['staff', 'super_admin'].includes(callerProfile.role) || !callerProfile.is_active) {
    throw new DeliverPlateConfirmationNotificationsError('FORBIDDEN', 'Only an active admin can trigger plate-confirmation notifications.', 403)
  }

  if (!body.bookingId || typeof body.bookingId !== 'string') {
    throw new DeliverPlateConfirmationNotificationsError('VALIDATION_ERROR', 'bookingId is required.', 422, { bookingId: 'bookingId is required.' })
  }

  const language: EmailLanguage = body.language === 'ar' ? 'ar' : 'en'

  const emailOutcomes = await deliverPlateConfirmedNotificationEmail(
    { dataSource: deps.dataSource, emailLog: deps.emailLog, resendConfig: deps.resendConfig, siteBaseUrl: deps.siteBaseUrl, sendEmail: deps.sendEmail },
    body.bookingId,
    language,
  )

  const whatsappOutcomes: { notificationId: string; outcome: PlateConfirmedWhatsappOutcome }[] = []
  for (const email of emailOutcomes) {
    const outcome = await dispatchPlateConfirmedWhatsapp({ dataSource: deps.whatsappSource, getEnv: deps.getEnv }, email.notificationId)
    whatsappOutcomes.push({ notificationId: email.notificationId, outcome })
  }

  return { emailOutcomes, whatsappOutcomes }
}
