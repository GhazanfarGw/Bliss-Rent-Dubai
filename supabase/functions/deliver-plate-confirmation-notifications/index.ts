// Phase 14 — deliver-plate-confirmation-notifications Edge Function.
//
// Admin-triggered delivery of the plate_confirmed customer email + WhatsApp
// dispatch, mirroring deliver-extension-notifications/index.ts's wiring
// exactly: service-role client, dependency-injected auth checks, typed
// error mapping.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createSupabaseEmailLogStore } from '../_shared/email/supabaseEmailLogStore.ts'
import { getResendSenderConfig } from '../_shared/email/emailSenderConfig.ts'
import {
  handleDeliverPlateConfirmationNotifications,
  DeliverPlateConfirmationNotificationsError,
  type DeliverPlateConfirmationNotificationsRequestBody,
  type DeliverPlateConfirmationNotificationsDeps,
} from './logic.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: DeliverPlateConfirmationNotificationsRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ code: 'VALIDATION_ERROR', message: 'Request body must be JSON.' }, 400)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const deps: DeliverPlateConfirmationNotificationsDeps = {
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
    // supabase-js already satisfies the narrow read-only/update shapes
    // this function's deps need — same convention as every other Edge
    // Function in this codebase.
    dataSource: supabaseAdmin,
    whatsappSource: supabaseAdmin,
    getEnv: (name: string) => Deno.env.get(name),
    emailLog: createSupabaseEmailLogStore(supabaseAdmin),
    resendConfig: {
      apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
      fromAddress: getResendSenderConfig('customer', Deno.env).fromAddress,
      replyTo: getResendSenderConfig('customer', Deno.env).replyTo,
    },
    siteBaseUrl: Deno.env.get('SITE_BASE_URL') ?? 'https://bliss.rent',
  }

  try {
    const result = await handleDeliverPlateConfirmationNotifications(req.headers.get('Authorization'), body, deps)
    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof DeliverPlateConfirmationNotificationsError) {
      return jsonResponse({ code: err.code, message: err.message, fieldErrors: err.fieldErrors }, err.httpStatus)
    }
    console.error('deliver-plate-confirmation-notifications unexpected error', err)
    return jsonResponse(
      { code: 'SERVER_ERROR', message: 'Something went wrong while sending plate-confirmation notifications. Please try again.' },
      500,
    )
  }
})
