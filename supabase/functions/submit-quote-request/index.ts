// "Get a quote" form — submit-quote-request Edge Function.
//
// Runs with the service-role key (never shipped to the browser) so it can
// call submit_quote_request_public(), which is granted to service_role
// only. All validation lives in ./logic.ts; this file is HTTP plumbing
// plus the best-effort admin email.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { ApiError } from '../_shared/errors.ts'
import { handleSubmitQuoteRequest, normalizePhone, type SubmitQuoteRequestBody } from './logic.ts'
import { triggerQuoteNotification } from '../_shared/email/quoteNotification.ts'
import { createSupabaseAdminEmailLogStore } from '../_shared/email/supabaseAdminEmailLogStore.ts'
import { getResendSenderConfig } from '../_shared/email/emailSenderConfig.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: SubmitQuoteRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ code: 'VALIDATION_ERROR', message: 'Request body must be JSON.' }, 400)
  }

  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  try {
    const result = await handleSubmitQuoteRequest(body, supabaseAdmin)

    if (!result.discarded && result.leadId) {
      const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
      await triggerQuoteNotification({
        adminsSource: supabaseAdmin,
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
        quote: {
          leadId: result.leadId,
          fullName: s(body.fullName) ?? 'Customer',
          phone: normalizePhone(typeof body.phone === 'string' ? body.phone : '') ?? '',
          email: s(body.email),
          carInterest: s(body.carInterest),
          startDate: s(body.startDate),
          endDate: s(body.endDate),
          notes: s(body.notes),
          source: s(body.utmSource) ?? 'website',
        },
      })
    }

    return jsonResponse({ ok: true, leadId: result.leadId }, 200)
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonResponse({ code: err.code, message: err.message, fieldErrors: err.fieldErrors }, err.httpStatus)
    }
    console.error('submit-quote-request unexpected error', err)
    return jsonResponse({ code: 'SERVER_ERROR', message: 'Something went wrong. Please try again or message us on WhatsApp.' }, 500)
  }
})
