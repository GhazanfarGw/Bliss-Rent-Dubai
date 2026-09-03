// Phase 9H — submit-complaint Edge Function.
//
// The Contact Us form's real backend. Runs with the service-role key
// (never shipped to the browser) so it can call submit_complaint_public()
// — that SQL function is revoked from anon/authenticated and granted only
// to service_role, the same "guest mutation needs a service-role key"
// convention as create-booking and submit-extension-request. All the
// actual logic lives in ./logic.ts so it can be unit-tested; this file
// only wires up the HTTP/Deno plumbing.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { handleSubmitComplaint, type SubmitComplaintRequestBody } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'
import { triggerComplaintNotification } from '../_shared/email/triggerComplaintNotification.ts'
import { createSupabaseAdminEmailLogStore } from '../_shared/email/supabaseAdminEmailLogStore.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: SubmitComplaintRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ code: 'VALIDATION_ERROR', message: 'Request body must be JSON.' }, 400)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const result = await handleSubmitComplaint(body, supabaseAdmin)

    // Phase 9H: admin_complaint_received — notify every currently active
    // admin that a new Contact Us message arrived. Best-effort:
    // triggerComplaintNotification never throws, so this can never affect
    // the already-successful submission response the guest is waiting on.
    await triggerComplaintNotification({
      adminsSource: supabaseAdmin,
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
      complaintId: result.complaintId,
      reporterName: typeof body.fullName === 'string' ? body.fullName.trim() : 'Customer',
      reporterEmail: typeof body.email === 'string' ? body.email.trim() : '',
      subject: typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim() : 'Message from Contact Us form',
      description: typeof body.message === 'string' ? body.message.trim() : '',
      language: 'en',
      dashboardPath: '/admin/complaints',
    })

    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonResponse(
        { code: err.code, message: err.message, fieldErrors: err.fieldErrors },
        err.httpStatus,
      )
    }
    console.error('submit-complaint unexpected error', err)
    return jsonResponse(
      { code: 'SERVER_ERROR', message: 'Something went wrong while sending your message. Please try again.' },
      500,
    )
  }
})
