import { deliverAdminOperationalEmails, type DeliverAdminOperationalEmailsDataSource } from './deliverAdminOperationalEmails.ts'
import type { AdminEmailLogStore, SendAdminEmailFn } from './sendAdminOperationalEmail.ts'
import type { GetAdminEmailFn } from './adminRecipients.ts'
import type { AdminOperationalEventType } from './adminOperationalEmailContent.ts'
import type { ResendConfig } from './resendProvider.ts'
import type { EmailLanguage } from './strings.ts'

export interface TriggerAdminOperationalEmailParams {
  dataSource: DeliverAdminOperationalEmailsDataSource
  getAdminEmail: GetAdminEmailFn
  emailLog: AdminEmailLogStore
  resendConfig: ResendConfig
  siteBaseUrl: string
  bookingId: string
  eventType: AdminOperationalEventType
  language: EmailLanguage
  dashboardPath: string
  triggeringRowId?: string
  sendEmail?: SendAdminEmailFn
}

export async function triggerAdminOperationalEmail(params: TriggerAdminOperationalEmailParams): Promise<void> {
  try {
    await deliverAdminOperationalEmails(
      {
        dataSource: params.dataSource,
        getAdminEmail: params.getAdminEmail,
        emailLog: params.emailLog,
        resendConfig: params.resendConfig,
        siteBaseUrl: params.siteBaseUrl,
        sendEmail: params.sendEmail,
      },
      {
        bookingId: params.bookingId,
        eventType: params.eventType,
        language: params.language,
        dashboardPath: params.dashboardPath,
        triggeringRowId: params.triggeringRowId,
      },
    )
  } catch (err) {
    console.error(`triggerAdminOperationalEmail failed for booking ${params.bookingId} (${params.eventType})`, err)
  }
}
