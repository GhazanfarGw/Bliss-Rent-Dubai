// Phase 9G — send-rental-reminders Edge Function.
//
// Invoked once a day by a pg_cron schedule (see
// 20260914000000_phase9g_rental_reminders.sql), never by a browser.
// Reads `bookings` read-only and sends pickup/return reminder emails
// through the existing, unmodified 9D email_log/Resend pipeline. See
// logic.ts for the shared-secret auth this endpoint requires.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createSupabaseEmailLogStore } from '../_shared/email/supabaseEmailLogStore.ts'
import { handleSendRentalRemindersRequest, SendRentalRemindersError } from './logic.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const result = await handleSendRentalRemindersRequest(req.headers.get('Authorization'), Deno.env.get('CRON_SECRET'), {
      dataSource: supabaseAdmin,
      emailLog: createSupabaseEmailLogStore(supabaseAdmin),
      resendConfig: {
        apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
        fromAddress: Deno.env.get('RESEND_FROM_ADDRESS') ?? 'Bliss Rent <noreply@bliss.rent>',
      },
      siteBaseUrl: Deno.env.get('SITE_BASE_URL') ?? 'https://bliss.rent',
    })
    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof SendRentalRemindersError) {
      return jsonResponse({ code: err.code, message: err.message }, err.httpStatus)
    }
    console.error('send-rental-reminders unexpected error', err)
    return jsonResponse({ code: 'SERVER_ERROR', message: 'Something went wrong while sending rental reminders.' }, 500)
  }
})
