// Phase 9H — pure, framework-free request handler for the submit-complaint
// Edge Function. Same split rationale as every other function in this
// repo — see create-booking/logic.ts.
//
// This is the Contact Us form's real backend, replacing its previous
// client-side-only stub (see src/features/content/ContactPage.tsx). It
// validates exactly what ContactPage.tsx already validates client-side
// (name, a plausible email, a non-empty message) — subject stays
// optional, matching the existing form — and inserts one row via
// submit_complaint_public(). It never checks anything about a booking; a
// Contact Us message may not reference one at all.
import { ApiError } from '../_shared/errors.ts'

export interface SubmitComplaintRequestBody {
  fullName?: string
  email?: string
  phone?: string
  subject?: string
  message?: string
}

export interface SubmitComplaintResult {
  complaintId: string
  status: string
}

export interface SupabaseLike {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }>
}

const EMAIL_RE = /^\S+@\S+\.\S+$/

/**
 * submit_complaint_public() only ever raises a plain Postgres exception
 * with a message already safe to show a guest verbatim (same convention
 * as submit-extension-request/logic.ts's mapExtensionError) — there's no
 * SQLSTATE-based distinction needed here.
 */
function mapComplaintError(message: string): ApiError {
  return new ApiError(
    'VALIDATION_ERROR',
    message || 'We could not send your message. Please double-check the form and try again.',
    422,
  )
}

export async function handleSubmitComplaint(
  body: SubmitComplaintRequestBody,
  supabase: SupabaseLike,
): Promise<SubmitComplaintResult> {
  const fieldErrors: Record<string, string> = {}

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  // Mirrors ContactPage.tsx's own client-side validation exactly — no
  // stricter and no looser, so a submission that passes the form's own
  // checks can never be rejected server-side for a reason the customer
  // was never shown.
  if (!fullName) fieldErrors.fullName = 'Please enter your name.'
  if (!EMAIL_RE.test(email)) fieldErrors.email = 'Please enter a valid email address.'
  if (!message) fieldErrors.message = 'Please enter a message.'

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError('VALIDATION_ERROR', 'Please check the highlighted fields.', 422, fieldErrors)
  }

  const { data, error } = await supabase.rpc('submit_complaint_public', {
    p_customer_full_name: fullName,
    p_customer_email: email,
    p_customer_phone: phone,
    p_subject: subject || null,
    p_description: message,
  })

  if (error) throw mapComplaintError(error.message)
  const row = data?.[0]
  if (!row) {
    throw new ApiError('SERVER_ERROR', 'Your message did not go through. Please try again.', 500)
  }

  return {
    complaintId: row.complaint_id as string,
    status: row.status as string,
  }
}
