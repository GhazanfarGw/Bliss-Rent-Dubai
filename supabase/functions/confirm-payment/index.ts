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
import { triggerCustomerBookingEmail } from '../_shared/email/triggerCustomerBookingEmail.ts'
import { createSupabaseEmailLogStore } from '../_shared/email/supabaseEmailLogStore.ts'
import { triggerAdminOperationalEmail } from '../_shared/email/triggerAdminOperationalEmail.ts'
import { createSupabaseAdminEmailLogStore } from '../_shared/email/supabaseAdminEmailLogStore.ts'
import type { EmailLanguage } from '../_shared/email/strings.ts'
import { getResendSenderConfig } from '../_shared/email/emailSenderConfig.ts'

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

    // Phase 9D: booking_confirmed on a successful payment, payment_failed
    // otherwise — the TEST payment provider's outcome, already decided
    // server-side inside handleConfirmPayment, is what picks the event;
    // nothing here re-derives or second-guesses that decision.
    // triggerCustomerBookingEmail never throws, so this can never affect
    // the already-successful confirm-payment response.
    await triggerCustomerBookingEmail({
      dataSource: supabaseAdmin,
      emailLog: createSupabaseEmailLogStore(supabaseAdmin),
      resendConfig: {
        apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
        fromAddress: getResendSenderConfig('customer', Deno.env).fromAddress,
        replyTo: getResendSenderConfig('customer', Deno.env).replyTo,
      },
      siteBaseUrl: Deno.env.get('SITE_BASE_URL') ?? 'https://bliss.rent',
      bookingId: result.bookingId,
      eventType: result.paymentStatus === 'paid' ? 'booking_confirmed' : 'payment_failed',
      language,
    })

    // Phase 9F: admin-side mirror of the same event, to every currently
    // active admin (see adminRecipients.ts). Same paid/failed branch the
    // customer email above already used — nothing here re-derives it.
    await triggerAdminOperationalEmail({
      dataSource: supabaseAdmin,
      async getAdminEmail(id: string) {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(id)
        if (error || !data.user) return null
        return data.user.email ?? null
      },
      emailLog: createSupabaseAdminEmailLogStore(supabaseAdmin),
      resendConfig: {
        apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
        fromAddress: getResendSenderConfig('admin', Deno.env).fromAddress,
        replyTo: getResendSenderConfig('admin', Deno.env).replyTo,
      },
      siteBaseUrl: Deno.env.get('SITE_BASE_URL') ?? 'https://bliss.rent',
      bookingId: result.bookingId,
      eventType: result.paymentStatus === 'paid' ? 'admin_booking_confirmed' : 'admin_payment_failed',
      language,
      dashboardPath: `/admin/bookings/${result.bookingId}`,
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
