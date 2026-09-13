// Site-wide Feedback widget — submit-feedback Edge Function.
//
// Backend for FeedbackWidget.tsx's sticky star-rating + message form,
// shown on every public page (see Layout.tsx). Runs with the
// service-role key (never shipped to the browser) so it can call
// submit_site_feedback_public() — that SQL function is revoked from
// anon/authenticated and granted only to service_role, the same "guest
// mutation needs a service-role key" convention as create-booking and
// submit-complaint. All the actual logic lives in ./logic.ts so it can be
// unit-tested; this file only wires up the HTTP/Deno plumbing.
//
// Deliberately no admin-notification email here (unlike submit-complaint)
// — feedback is anonymous, ambient sentiment, not a support request
// waiting on a reply; admins review it in bulk on /admin/feedback instead.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { handleSubmitFeedback, type SubmitFeedbackRequestBody } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: SubmitFeedbackRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ code: 'VALIDATION_ERROR', message: 'Request body must be JSON.' }, 400)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const result = await handleSubmitFeedback(body, supabaseAdmin)
    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonResponse({ code: err.code, message: err.message, fieldErrors: err.fieldErrors }, err.httpStatus)
    }
    console.error('submit-feedback unexpected error', err)
    return jsonResponse(
      { code: 'SERVER_ERROR', message: 'Something went wrong while sending your feedback. Please try again.' },
      500,
    )
  }
})
