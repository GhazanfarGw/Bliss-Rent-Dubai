// support-chat-start Edge Function — opens a new Support Chat conversation
// for SupportChatWidget.tsx. Runs with the service-role key (never shipped
// to the browser) so it can call start_support_chat_public() and upload to
// the private 'complaint-attachments' bucket — same "guest mutation needs
// a service-role key" convention as submit-complaint. All the actual
// logic lives in ./logic.ts so it can be unit-tested; this file only
// wires up the HTTP/Deno/storage plumbing.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { handleSupportChatStart, type SupportChatStartRequestBody } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'
import { triggerComplaintNotification } from '../_shared/email/triggerComplaintNotification.ts'
import { createSupabaseAdminEmailLogStore } from '../_shared/email/supabaseAdminEmailLogStore.ts'
import { getResendSenderConfig } from '../_shared/email/emailSenderConfig.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: SupportChatStartRequestBody
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
    const result = await handleSupportChatStart(body, {
      rpc: (fn, args) => supabaseAdmin.rpc(fn, args),
      async uploadImage(path, bytes, contentType) {
        const { error } = await supabaseAdmin.storage.from('complaint-attachments').upload(path, bytes, { contentType })
        return { error: error ? { message: error.message } : null }
      },
    })

    // Same admin_complaint_received notification as submit-complaint —
    // this is the exact same `complaints` inbox, just opened from the
    // chat widget instead of the Contact Us form. Best-effort: never
    // throws, so it can never affect the already-successful conversation
    // the guest is waiting on.
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
        fromAddress: getResendSenderConfig('admin', Deno.env).fromAddress,
        replyTo: getResendSenderConfig('admin', Deno.env).replyTo,
      },
      siteBaseUrl: Deno.env.get('SITE_BASE_URL') ?? 'https://bliss.rent',
      complaintId: result.complaintId,
      reporterName: typeof body.fullName === 'string' ? body.fullName.trim() : 'Customer',
      reporterEmail: typeof body.email === 'string' ? body.email.trim() : '',
      subject: 'New support chat message',
      description: typeof body.message === 'string' && body.message.trim() ? body.message.trim() : '(Photo attached)',
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
    console.error('support-chat-start unexpected error', err)
    return jsonResponse(
      { code: 'SERVER_ERROR', message: 'Something went wrong while sending your message. Please try again.' },
      500,
    )
  }
})
