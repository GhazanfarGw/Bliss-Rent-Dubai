// Phase 9F — notify-admin-booking-cancelled Edge Function.
//
// Admin-triggered admin-notification email for a cancelled booking. See
// logic.ts's file header for why this exists as its own small function
// rather than an in-process trigger (adminBookingsApi.ts's cancellation
// flow is a plain browser-side RLS UPDATE, not an Edge Function call).
// Wiring mirrors deliver-extension-notifications/index.ts and
// send-customer-email/index.ts exactly: service-role client,
// dependency-injected auth checks, typed error mapping.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createSupabaseAdminEmailLogStore } from '../_shared/email/supabaseAdminEmailLogStore.ts'
import { getResendSenderConfig } from '../_shared/email/emailSenderConfig.ts'
import {
  handleNotifyAdminBookingCancelled,
  NotifyAdminBookingCancelledError,
  type NotifyAdminBookingCancelledRequestBody,
  type NotifyAdminBookingCancelledDeps,
} from './logic.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: NotifyAdminBookingCancelledRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ code: 'VALIDATION_ERROR', message: 'Request body must be JSON.' }, 400)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const deps: NotifyAdminBookingCancelledDeps = {
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
    // The supabase-js client already satisfies the narrow read-only
    // shape DeliverAdminOperationalEmailsDataSource needs (bookings +
    // admin_profiles) — same convention as every other Edge Function's
    // deps object in this codebase.
    dataSource: supabaseAdmin,
    // Email addresses live only in Supabase Auth (see adminRecipients.ts)
    // — auth.admin.getUserById is service-role only, exactly like
    // admin-create-staff's createAuthUser/deleteAuthUser.
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
  }

  try {
    const result = await handleNotifyAdminBookingCancelled(req.headers.get('Authorization'), body, deps)
    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof NotifyAdminBookingCancelledError) {
      return jsonResponse({ code: err.code, message: err.message, fieldErrors: err.fieldErrors }, err.httpStatus)
    }
    console.error('notify-admin-booking-cancelled unexpected error', err)
    return jsonResponse(
      { code: 'SERVER_ERROR', message: 'Something went wrong while sending the admin notification email. Please try again.' },
      500,
    )
  }
})
