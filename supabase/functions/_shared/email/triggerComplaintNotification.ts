// Phase 9H — the never-throws top-level wrapper, mirroring 9F's
// triggerAdminOperationalEmail.ts exactly: a complaint has already been
// durably inserted by the time this runs (submit-complaint/index.ts calls
// this AFTER submit_complaint_public() commits), so a notification
// problem here must never surface as a failure of the guest's already-
// successful submission.

import { deliverComplaintNotification, type DeliverComplaintNotificationDeps, type DeliverComplaintNotificationParams } from './deliverComplaintNotification.ts'

export type TriggerComplaintNotificationParams = DeliverComplaintNotificationDeps & DeliverComplaintNotificationParams

export async function triggerComplaintNotification(params: TriggerComplaintNotificationParams): Promise<void> {
  try {
    await deliverComplaintNotification(
      {
        adminsSource: params.adminsSource,
        getAdminEmail: params.getAdminEmail,
        emailLog: params.emailLog,
        resendConfig: params.resendConfig,
        siteBaseUrl: params.siteBaseUrl,
        sendEmail: params.sendEmail,
      },
      {
        complaintId: params.complaintId,
        reporterName: params.reporterName,
        reporterEmail: params.reporterEmail,
        subject: params.subject,
        description: params.description,
        language: params.language,
        dashboardPath: params.dashboardPath,
      },
    )
  } catch (err) {
    console.error('admin_complaint_received notification failed', err)
  }
}
