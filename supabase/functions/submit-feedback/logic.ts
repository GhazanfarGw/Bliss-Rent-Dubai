// Site-wide Feedback widget — pure, framework-free request handler for the
// submit-feedback Edge Function. Same split rationale as every other
// function in this repo — see create-booking/logic.ts.
//
// Unlike submit-complaint, feedback is anonymous: no name/email/phone is
// collected or required. The only required field is a 1-5 star rating;
// the message, page path, and locale are all optional context — a visitor
// may leave nothing but stars.
import { ApiError } from '../_shared/errors.ts'

export interface SubmitFeedbackRequestBody {
  rating?: number
  message?: string
  pagePath?: string
  locale?: string
}

export interface SubmitFeedbackResult {
  feedbackId: string
}

export interface SupabaseLike {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }>
}

/**
 * submit_site_feedback_public() only ever raises a plain Postgres
 * exception with a message already safe to show a guest verbatim — same
 * convention as submit-complaint/logic.ts's mapComplaintError.
 */
function mapFeedbackError(message: string): ApiError {
  return new ApiError('VALIDATION_ERROR', message || 'We could not send your feedback. Please try again.', 422)
}

export async function handleSubmitFeedback(
  body: SubmitFeedbackRequestBody,
  supabase: SupabaseLike,
): Promise<SubmitFeedbackResult> {
  const rating = typeof body.rating === 'number' ? body.rating : Number(body.rating)
  const message = typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null
  const pagePath = typeof body.pagePath === 'string' && body.pagePath.trim() ? body.pagePath.trim() : null
  const locale = typeof body.locale === 'string' && body.locale.trim() ? body.locale.trim() : null

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Please choose a star rating.',
      422,
      { rating: 'Please choose a rating from 1 to 5 stars.' },
    )
  }

  const { data, error } = await supabase.rpc('submit_site_feedback_public', {
    p_rating: rating,
    p_message: message,
    p_page_path: pagePath,
    p_locale: locale,
  })

  if (error) throw mapFeedbackError(error.message)
  const row = data?.[0]
  if (!row) {
    throw new ApiError('SERVER_ERROR', 'Your feedback did not go through. Please try again.', 500)
  }

  return {
    feedbackId: row.feedback_id as string,
  }
}
