// Phase 9G — send-rental-reminders Edge Function logic.
//
// This function is invoked by a schedule (pg_cron via pg_net — see
// 20260914000000_phase9g_rental_reminders.sql), not by a browser or an
// admin session, so the usual "resolve the caller's admin_profiles row"
// auth pattern doesn't apply — there is no user token to resolve. It's
// protected instead by a shared secret (`CRON_SECRET`, set as an Edge
// Function env var and read by the migration from Supabase Vault, never
// hardcoded into SQL) checked against the request's Authorization header
// — the standard pattern for a scheduled Edge Function that must reject
// arbitrary public requests.
import { handleSendRentalReminders, type SendRentalRemindersDeps, type ReminderOutcome } from '../_shared/email/rentalReminders.ts'

export type SendRentalRemindersErrorCode = 'UNAUTHORIZED' | 'SERVER_ERROR'

export class SendRentalRemindersError extends Error {
  code: SendRentalRemindersErrorCode
  httpStatus: number
  constructor(code: SendRentalRemindersErrorCode, message: string, httpStatus: number) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
  }
}

export function assertValidCronSecret(authHeader: string | null, expectedSecret: string | undefined): void {
  if (!expectedSecret) {
    throw new SendRentalRemindersError('SERVER_ERROR', 'CRON_SECRET is not configured for this function.', 500)
  }
  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    throw new SendRentalRemindersError('UNAUTHORIZED', 'Missing or invalid cron secret.', 401)
  }
}

export interface SendRentalRemindersResult {
  sent: number
  skipped: number
  failed: number
  outcomes: ReminderOutcome[]
}

function summarize(outcomes: ReminderOutcome[]): SendRentalRemindersResult {
  let sent = 0
  let skipped = 0
  let failed = 0
  for (const outcome of outcomes) {
    if (outcome.status === 'sent') sent += 1
    else if (outcome.status === 'skipped_duplicate') skipped += 1
    else failed += 1 // send_failed or skipped_error — both are visible-but-isolated problems, not silent
  }
  return { sent, skipped, failed, outcomes }
}

export async function handleSendRentalRemindersRequest(
  authHeader: string | null,
  cronSecret: string | undefined,
  deps: SendRentalRemindersDeps,
): Promise<SendRentalRemindersResult> {
  assertValidCronSecret(authHeader, cronSecret)
  const outcomes = await handleSendRentalReminders(deps)
  return summarize(outcomes)
}
