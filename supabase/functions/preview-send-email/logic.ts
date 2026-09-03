// Phase 9I — pure, framework-free request handler for the
// preview-send-email Edge Function. Same split rationale as every other
// logic.ts in this codebase (create-booking, admin-create-staff, etc.):
// zero Deno-specific imports, runs directly under vitest.
//
// Three modes, one endpoint:
//   - 'catalog' — returns previewRenderer.ts's listPreviewCatalog(), the
//     single source of truth for which (category, eventType) pairs this
//     tool can render. Added in 9J so the admin dashboard's template
//     picker (adminEmailApi.ts) never hand-maintains its own copy of
//     that list — one list, read from the same place this function's
//     own 'preview'/'send' modes already read it from.
//   - 'preview' — renders any real template (previewRenderer.ts) against
//     9B's existing fake QA data and returns the HTML. Never touches
//     email_log, never calls Resend, never resolves a real recipient.
//   - 'send' — actually calls Resend, but ONLY to a recipient that
//     passes BOTH of the confirmed business-decision safeguards
//     (testModeConfig.ts: TEST_MODE flag + server-side allowlist).
//     Deliberately bypasses email_log entirely — this is a QA/test send,
//     never a real customer/admin notification, and must never appear
//     in, or be confused with, the real delivery log or its idempotency
//     guarantees (see phase-9c-email-log-table-completion-2026-08-31.md).
//
// Auth: any currently active admin (staff or super_admin) may use this
// tool — unlike admin-create-staff, nothing here is destructive or
// privilege-escalating; a 'send' attempt is still hard-gated server-side
// to an allowlisted test address no matter who calls it.

import { renderPreview, listPreviewCatalog, type PreviewCategory } from '../_shared/email/previewRenderer.ts'
import { checkTestSendAllowed, type TestSendGuardConfig } from '../_shared/email/testModeConfig.ts'
import type { PreviewCatalogEntry } from '../_shared/email/previewRenderer.ts'
import type { ResendConfig, SendEmailResult } from '../_shared/email/resendProvider.ts'
import type { EmailLanguage } from '../_shared/email/strings.ts'

export type PreviewSendErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'UNKNOWN_TEMPLATE'
  | 'TEST_SEND_NOT_ALLOWED'
  | 'SEND_FAILED'
  | 'SERVER_ERROR'

export class PreviewSendError extends Error {
  code: PreviewSendErrorCode
  httpStatus: number

  constructor(code: PreviewSendErrorCode, message: string, httpStatus: number) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
  }
}

export interface CallerProfile {
  role: string
  is_active: boolean
}

export interface PreviewSendRequestBody {
  category?: string
  eventType?: string
  language?: string
  mode?: string
  /** Required, and only meaningful, when mode is 'send'. */
  recipientEmail?: string
}

export type PreviewSendResult =
  | { mode: 'catalog'; catalog: PreviewCatalogEntry[] }
  | { mode: 'preview'; html: string }
  | { mode: 'send'; sent: true; providerMessageId?: string }

export interface PreviewSendDeps {
  getCallerUserId(accessToken: string): Promise<string | null>
  getCallerProfile(id: string): Promise<CallerProfile | null>
  testSendGuardConfig: TestSendGuardConfig
  resendConfig: ResendConfig
  /** Injectable for tests — defaults to the real sendViaResend at the index.ts wiring layer. */
  sendEmail(config: ResendConfig, params: { to: string; subject: string; html: string }): Promise<SendEmailResult>
}

const VALID_CATEGORIES: PreviewCategory[] = ['customer', 'admin', 'complaint']
const VALID_LANGUAGES: EmailLanguage[] = ['en', 'ar']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function handlePreviewSendEmail(
  authHeader: string | null,
  body: PreviewSendRequestBody,
  deps: PreviewSendDeps,
): Promise<PreviewSendResult> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw new PreviewSendError('UNAUTHORIZED', 'You must be signed in to do that.', 401)
  }

  const callerId = await deps.getCallerUserId(token)
  if (!callerId) {
    throw new PreviewSendError('UNAUTHORIZED', 'Your session has expired. Please sign in again.', 401)
  }

  const callerProfile = await deps.getCallerProfile(callerId)
  if (!callerProfile || !callerProfile.is_active) {
    throw new PreviewSendError('FORBIDDEN', 'Only active admin accounts can use the email preview tool.', 403)
  }

  if (body.mode === 'catalog') {
    return { mode: 'catalog', catalog: listPreviewCatalog() }
  }

  const category = body.category as PreviewCategory
  if (!VALID_CATEGORIES.includes(category)) {
    throw new PreviewSendError('VALIDATION_ERROR', 'category must be one of: customer, admin, complaint.', 422)
  }

  const language = body.language as EmailLanguage
  if (!VALID_LANGUAGES.includes(language)) {
    throw new PreviewSendError('VALIDATION_ERROR', 'language must be one of: en, ar.', 422)
  }

  const eventType = (body.eventType ?? '').trim()
  if (!eventType) {
    throw new PreviewSendError('VALIDATION_ERROR', 'eventType is required.', 422)
  }

  let html: string
  try {
    html = renderPreview(category, eventType, language)
  } catch {
    throw new PreviewSendError('UNKNOWN_TEMPLATE', `No template found for ${category}/${eventType}.`, 404)
  }

  if (body.mode === 'preview' || body.mode === undefined) {
    return { mode: 'preview', html }
  }

  if (body.mode !== 'send') {
    throw new PreviewSendError('VALIDATION_ERROR', "mode must be 'preview' or 'send'.", 422)
  }

  const recipientEmail = (body.recipientEmail ?? '').trim().toLowerCase()
  if (!recipientEmail || !EMAIL_RE.test(recipientEmail)) {
    throw new PreviewSendError('VALIDATION_ERROR', 'A valid recipientEmail is required for a test send.', 422)
  }

  const guard = checkTestSendAllowed(recipientEmail, deps.testSendGuardConfig)
  if (!guard.allowed) {
    const message =
      guard.reason === 'TEST_MODE_DISABLED'
        ? 'Test sending is currently disabled (TEST_MODE is off).'
        : 'This recipient is not on the server-side test-send allowlist.'
    throw new PreviewSendError('TEST_SEND_NOT_ALLOWED', message, 403)
  }

  const result = await deps.sendEmail(deps.resendConfig, {
    to: recipientEmail,
    subject: `[TEST SEND] ${category}/${eventType} (${language})`,
    html,
  })

  if (!result.ok) {
    throw new PreviewSendError('SEND_FAILED', result.errorMessage ?? 'Resend could not send the test email.', 502)
  }

  return { mode: 'send', sent: true, providerMessageId: result.providerMessageId }
}
