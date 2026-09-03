// Phase 2 — create-booking Edge Function.
//
// This is the ONLY place a booking can be created. It runs with the
// service-role key (never shipped to the browser) so it can write
// customers/bookings/drivers/payments for a guest checkout — see the
// migration comment in
// supabase/migrations/20260826000000_phase2_booking_checkout.sql for why
// that's necessary. All the actual logic lives in ./logic.ts so it can
// be unit-tested; this file only wires up the HTTP/Deno plumbing.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { handleCreateBooking, type CreateBookingRequestBody } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'
import { triggerCustomerBookingEmail } from '../_shared/email/triggerCustomerBookingEmail.ts'
import { createSupabaseEmailLogStore } from '../_shared/email/supabaseEmailLogStore.ts'
import { triggerAdminOperationalEmail } from '../_shared/email/triggerAdminOperationalEmail.ts'
import { createSupabaseAdminEmailLogStore } from '../_shared/email/supabaseAdminEmailLogStore.ts'
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
  const body = rawBody as CreateBookingRequestBody
  // Phase 9D: loosely read here, purely to pick the customer email's
  // language — CreateBookingRequestBody/logic.ts stay untouched, so this
  // can never affect booking validation or business rules.
  const language: EmailLanguage = isPlainObject(rawBody) && rawBody.language === 'ar' ? 'ar' : 'en'

  // Server-side only client, using the service-role key. This is what
  // lets create_booking()/confirm_payment() be reachable at all — they
  // are explicitly revoked from anon/authenticated in the migration.
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const result = await handleCreateBooking(body, supabaseAdmin)

    // Phase 9D: fire the booking_received customer email after the
    // booking itself is fully committed. triggerCustomerBookingEmail
    // never throws, so an email/Resend problem can never turn this
    // already-successful booking into an error response.
    await triggerCustomerBookingEmail({
      dataSource: supabaseAdmin,
      emailLog: createSupabaseEmailLogStore(supabaseAdmin),
      resendConfig: {
        apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
        fromAddress: Deno.env.get('RESEND_FROM_ADDRESS') ?? 'Bliss Rent <noreply@bliss.rent>',
      },
      siteBaseUrl: Deno.env.get('SITE_BASE_URL') ?? 'https://bliss.rent',
      bookingId: result.bookingId,
      eventType: 'booking_received',
      language,
    })

    // Phase 9F: admin-side mirror of the same event, to every currently
    // active admin (see adminRecipients.ts). Same best-effort guarantee —
    // triggerAdminOperationalEmail never throws.
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
        fromAddress: Deno.env.get('RESEND_FROM_ADDRESS') ?? 'Bliss Rent <noreply@bliss.rent>',
      },
      siteBaseUrl: Deno.env.get('SITE_BASE_URL') ?? 'https://bliss.rent',
      bookingId: result.bookingId,
      eventType: 'admin_booking_received',
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
    console.error('create-booking unexpected error', err)
    return jsonResponse(
      { code: 'SERVER_ERROR', message: 'Something went wrong while processing your booking. Please try again.' },
      500,
    )
  }
})

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
