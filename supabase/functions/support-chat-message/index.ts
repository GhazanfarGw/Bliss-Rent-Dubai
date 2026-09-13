// support-chat-message Edge Function — appends a follow-up customer
// message to a Support Chat conversation support-chat-start already
// opened. Runs with the service-role key so it can call
// post_support_chat_message_public() and upload to the private
// 'complaint-attachments' bucket. Deliberately does NOT re-trigger the
// admin_complaint_received email on every follow-up (that would spam an
// admin's inbox once per chat message) — support-chat-start already
// notified them once; from here they see follow-ups live, the same way
// the customer does, by polling support-chat-thread. All the actual
// logic lives in ./logic.ts so it can be unit-tested; this file only
// wires up the HTTP/Deno/storage plumbing.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { handleSupportChatMessage, type SupportChatMessageRequestBody } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: SupportChatMessageRequestBody
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
    const result = await handleSupportChatMessage(body, {
      rpc: (fn, args) => supabaseAdmin.rpc(fn, args),
      async uploadImage(path, bytes, contentType) {
        const { error } = await supabaseAdmin.storage.from('complaint-attachments').upload(path, bytes, { contentType })
        return { error: error ? { message: error.message } : null }
      },
    })
    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonResponse(
        { code: err.code, message: err.message, fieldErrors: err.fieldErrors },
        err.httpStatus,
      )
    }
    console.error('support-chat-message unexpected error', err)
    return jsonResponse(
      { code: 'SERVER_ERROR', message: 'Something went wrong while sending your message. Please try again.' },
      500,
    )
  }
})
