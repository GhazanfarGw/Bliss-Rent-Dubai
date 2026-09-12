// Phase 9I — preview-send-email Edge Function.
//
// Admin-authenticated (any active admin_profiles row — see logic.ts for
// why this doesn't need the super_admin-only bar admin-create-staff
// uses). Renders any real template against fake QA data ('preview'
// mode), or — only when both TEST_MODE and the server-side recipient
// allowlist secrets permit it — actually sends that render through
// Resend to an allowlisted test address ('send' mode). Never touches
// email_log either way; this is a QA tool, not a delivery path.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { handlePreviewSendEmail, PreviewSendError, type PreviewSendRequestBody, type PreviewSendDeps } from './logic.ts'
import { sendViaResend } from '../_shared/email/resendProvider.ts'
import { getResendSenderConfig } from '../_shared/email/emailSenderConfig.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: PreviewSendRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ code: 'VALIDATION_ERROR', message: 'Request body must be JSON.' }, 400)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const deps: PreviewSendDeps = {
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
    testSendGuardConfig: {
      testModeRaw: Deno.env.get('TEST_MODE'),
      allowlistRaw: Deno.env.get('TEST_EMAIL_ALLOWLIST'),
    },
    // 'customer' uses the customer sender; 'admin' and 'complaint' both
    // land in an admin inbox, so both use the admin sender. Falls back to
    // 'admin' for any unrecognized value — handlePreviewSendEmail below
    // still does the real category validation and rejects it either way.
    resendConfig: getResendSenderConfig(body.category === 'customer' ? 'customer' : 'admin', Deno.env),
    sendEmail: sendViaResend,
  }

  try {
    const result = await handlePreviewSendEmail(req.headers.get('Authorization'), body, deps)
    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof PreviewSendError) {
      return jsonResponse({ code: err.code, message: err.message }, err.httpStatus)
    }
    console.error('preview-send-email unexpected error', err)
    return jsonResponse({ code: 'SERVER_ERROR', message: 'Something went wrong while rendering that email.' }, 500)
  }
})
