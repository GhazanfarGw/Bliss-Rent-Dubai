// Phase 9D — send-customer-email Edge Function.
//
// Admin-triggered customer email sends. See logic.ts's file header for
// why this exists (cancellation has no existing Edge Function hook, unlike
// booking creation / payment confirmation, which trigger their customer
// emails in-process from their own index.ts — see
// _shared/email/triggerCustomerBookingEmail.ts). Wiring here mirrors
// admin-create-staff/index.ts's exact pattern: a service-role client,
// dependency-injected auth checks, typed error mapping.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createSupabaseEmailLogStore } from '../_shared/email/supabaseEmailLogStore.ts'
import {
  handleSendCustomerEmail,
  SendCustomerEmailError,
  type SendCustomerEmailRequestBody,
  type SendCustomerEmailDeps,
} from './logic.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: SendCustomerEmailRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ code: 'VALIDATION_ERROR', message: 'Request body must be JSON.' }, 400)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const deps: SendCustomerEmailDeps = {
    async getCallerUserId(accessToken) {
      const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
      if (error || !data.user) return null
      return data.user.id
    },
    async getCallerProfile(id) {
      const { data, error } = await supabaseAdmin
        .from('admin_profiles')
        .select('role, is_active')
        .eq('id', id)
        .maybeSingle()
      if (error || !data) return null
      return data
    },
    // The supabase-js client already satisfies BookingEmailDataSource's
    // narrow `.from(table).select(cols).eq(col, val).maybeSingle()`
    // shape — same convention as create-booking/logic.ts's SupabaseLike.
    dataSource: supabaseAdmin,
    emailLog: createSupabaseEmailLogStore(supabaseAdmin),
    resendConfig: {
      apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
      fromAddress: Deno.env.get('RESEND_FROM_ADDRESS') ?? 'Bliss Rent <noreply@bliss.rent>',
    },
    siteBaseUrl: Deno.env.get('SITE_BASE_URL') ?? 'https://bliss.rent',
  }

  try {
    const result = await handleSendCustomerEmail(req.headers.get('Authorization'), body, deps)
    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof SendCustomerEmailError) {
      return jsonResponse({ code: err.code, message: err.message, fieldErrors: err.fieldErrors }, err.httpStatus)
    }
    console.error('send-customer-email unexpected error', err)
    return jsonResponse(
      { code: 'SERVER_ERROR', message: 'Something went wrong while sending the email. Please try again.' },
      500,
    )
  }
})
