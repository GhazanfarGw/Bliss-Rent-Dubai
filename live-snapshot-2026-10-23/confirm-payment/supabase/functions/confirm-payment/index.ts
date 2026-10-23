// Phase 2 — confirm-payment Edge Function.
//
// Resolves a pending payment to paid/failed and, on success, advances
// the booking to 'confirmed'. TEST ONLY payment provider — see
// _shared/testPaymentProvider.ts. Not reachable from the browser as a
// raw RPC (revoked from anon/authenticated) — this function, holding the
// service-role key, is the only caller.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { handleConfirmPayment, type ConfirmPaymentRequestBody } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'
import { sendPaymentOutcomeEmails } from '../_shared/email/triggerPaymentOutcomeEmails.ts'
import type { EmailLanguage } from '../_shared/email/strings.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return jsonResponse({ code: 'VALIDATION_ERROR', message: 'Request body must be JSON.' }, 400)
  }
  const body = rawBody as ConfirmPaymentRequestBody
  // Phase 9D: loosely read here, purely to pick the customer email's
  // language — ConfirmPaymentRequestBody/logic.ts stay untouched.
  const language: EmailLanguage = isPlainObject(rawBody) && rawBody.language === 'ar' ? 'ar' : 'en'

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const result = await handleConfirmPayment(body, supabaseAdmin)

    // Phase 9D/9F, extracted checkout-v2 (2026-09-20) into
    // sendPaymentOutcomeEmails so confirm-stripe-payment's real-Stripe
    // path triggers the identical customer + admin emails. booking_
    // confirmed on a successful payment, payment_failed otherwise — the
    // TEST payment provider's outcome, already decided server-side inside
    // handleConfirmPayment, is what picks the event; nothing here
    // re-derives or second-guesses that decision. Never throws, so this
    // can never affect the already-successful confirm-payment response.
    await sendPaymentOutcomeEmails({
      supabaseAdmin,
      bookingId: result.bookingId,
      paymentStatus: result.paymentStatus as 'paid' | 'failed',
      language,
    })

    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonResponse(
        { code: err.code, message: err.message, fieldErrors: err.fieldErrors },
        err.httpStatus,
      )
    }
    console.error('confirm-payment unexpected error', err)
    return jsonResponse(
      { code: 'SERVER_ERROR', message: 'Something went wrong while confirming payment. Please try again.' },
      500,
    )
  }
})

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
