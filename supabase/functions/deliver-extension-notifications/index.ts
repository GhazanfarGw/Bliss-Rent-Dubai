// Phase 9E — deliver-extension-notifications Edge Function.
//
// Admin-triggered delivery of extension/reassignment customer emails. See
// logic.ts's file header for why this exists as its own function rather
// than an in-process trigger inside an existing index.ts (none of the
// three SQL functions this reads from are called through an Edge
// Function today). Wiring mirrors send-customer-email/index.ts and
// admin-create-staff/index.ts exactly: service-role client,
// dependency-injected auth checks, typed error mapping.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createSupabaseEmailLogStore } from '../_shared/email/supabaseEmailLogStore.ts'
import {
  handleDeliverExtensionNotifications,
  DeliverExtensionNotificationsError,
  type DeliverExtensionNotificationsRequestBody,
  type DeliverExtensionNotificationsDeps,
} from './logic.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: DeliverExtensionNotificationsRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ code: 'VALIDATION_ERROR', message: 'Request body must be JSON.' }, 400)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const deps: DeliverExtensionNotificationsDeps = {
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
    // shapes BookingEmailDataSource / ExtensionRecordSource /
    // BookingNotificationsSource all need — same convention as every
    // other Edge Function's deps object in this codebase.
    dataSource: supabaseAdmin,
    emailLog: createSupabaseEmailLogStore(supabaseAdmin),
    resendConfig: {
      apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
      fromAddress: Deno.env.get('RESEND_FROM_ADDRESS') ?? 'Bliss Rent <noreply@bliss.rent>',
    },
    siteBaseUrl: Deno.env.get('SITE_BASE_URL') ?? 'https://bliss.rent',
  }

  try {
    const result = await handleDeliverExtensionNotifications(req.headers.get('Authorization'), body, deps)
    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof DeliverExtensionNotificationsError) {
      return jsonResponse({ code: err.code, message: err.message, fieldErrors: err.fieldErrors }, err.httpStatus)
    }
    console.error('deliver-extension-notifications unexpected error', err)
    return jsonResponse(
      { code: 'SERVER_ERROR', message: 'Something went wrong while sending extension notification emails. Please try again.' },
      500,
    )
  }
})
