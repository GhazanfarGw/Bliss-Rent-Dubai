// Task 3 (2026-09-11 scoped update) — deliver-complaint-reply Edge
// Function. Admin-triggered delivery of the admin_complaint_reply
// customer email, mirroring deliver-plate-confirmation-notifications/
// index.ts's wiring exactly: service-role client, dependency-injected
// auth checks, typed error mapping.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createSupabaseComplaintReplyEmailLogStore } from '../_shared/email/supabaseComplaintReplyEmailLogStore.ts'
import { getResendSenderConfig } from '../_shared/email/emailSenderConfig.ts'
import {
  handleDeliverComplaintReply,
  DeliverComplaintReplyError,
  type DeliverComplaintReplyRequestBody,
  type DeliverComplaintReplyDeps,
} from './logic.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: DeliverComplaintReplyRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ code: 'VALIDATION_ERROR', message: 'Request body must be JSON.' }, 400)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const deps: DeliverComplaintReplyDeps = {
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
    dataSource: supabaseAdmin,
    emailLog: createSupabaseComplaintReplyEmailLogStore(supabaseAdmin),
    resendConfig: {
      apiKey: Deno.env.get('RESEND_API_KEY') ?? '',
      fromAddress: getResendSenderConfig('customer', Deno.env).fromAddress,
      replyTo: getResendSenderConfig('customer', Deno.env).replyTo,
    },
    siteBaseUrl: Deno.env.get('SITE_BASE_URL') ?? 'https://bliss.rent',
  }

  try {
    const result = await handleDeliverComplaintReply(req.headers.get('Authorization'), body, deps)
    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof DeliverComplaintReplyError) {
      return jsonResponse({ code: err.code, message: err.message, fieldErrors: err.fieldErrors }, err.httpStatus)
    }
    console.error('deliver-complaint-reply unexpected error', err)
    return jsonResponse(
      { code: 'SERVER_ERROR', message: 'Something went wrong while sending the reply. Please try again.' },
      500,
    )
  }
})
