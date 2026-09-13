// support-chat-thread Edge Function — read-only. Runs with the
// service-role key so it can read complaint_messages (RLS there is
// admin-only) and sign photo URLs out of the private
// 'complaint-attachments' bucket for a guest who was never given any
// direct storage access. All the actual logic lives in ./logic.ts so it
// can be unit-tested; this file only wires up the HTTP/Deno/DB plumbing.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { handleSupportChatThread, type SupportChatThreadRequestBody } from './logic.ts'
import { ApiError } from '../_shared/errors.ts'

const SIGNED_URL_TTL_SECONDS = 60 * 30 // 30 minutes — comfortably longer than one poll cycle, short enough that a stale/leaked link doesn't stay live.

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: SupportChatThreadRequestBody
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
    const result = await handleSupportChatThread(body, {
      async findComplaintByToken(token) {
        const { data, error } = await supabaseAdmin.from('complaints').select('id, status').eq('access_token', token).maybeSingle()
        if (error || !data) return null
        return data
      },
      async listMessages(complaintId) {
        const { data, error } = await supabaseAdmin
          .from('complaint_messages')
          .select('id, sender, body, image_path, created_at')
          .eq('complaint_id', complaintId)
          .order('created_at', { ascending: true })
        if (error) throw error
        return data ?? []
      },
      async getSignedImageUrl(path) {
        const { data, error } = await supabaseAdmin.storage
          .from('complaint-attachments')
          .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
        if (error || !data) return null
        return data.signedUrl
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
    console.error('support-chat-thread unexpected error', err)
    return jsonResponse(
      { code: 'SERVER_ERROR', message: 'Something went wrong while loading this conversation. Please try again.' },
      500,
    )
  }
})
