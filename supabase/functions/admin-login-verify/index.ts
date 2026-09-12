// Admin dashboard login, step 2 of 2 — checks the emailed code and, only
// if correct, hands back the real Supabase Auth session tokens that
// admin-login-start obtained but withheld. Runs entirely against
// admin_login_challenges via the SERVICE ROLE key (that table has zero
// RLS policies — this Edge Function and admin-login-start are the only
// things that can ever read or write it). See admin-login-start/logic.ts
// for the full design rationale.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { handleAdminLoginVerify, type AdminLoginVerifyBody, type AdminLoginVerifyDataSource } from './logic.ts'
import { AdminLoginError } from '../_shared/adminLoginCode.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: AdminLoginVerifyBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ code: 'VALIDATION_ERROR', message: 'Request body must be JSON.' }, 400)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const dataSource: AdminLoginVerifyDataSource = {
    async getChallenge(pendingToken) {
      const { data, error } = await supabaseAdmin
        .from('admin_login_challenges')
        .select('admin_user_id, code_hash, code_salt, access_token, refresh_token, attempts, expires_at')
        .eq('pending_token', pendingToken)
        .maybeSingle()
      if (error || !data) return null
      return {
        adminUserId: data.admin_user_id as string,
        codeHash: data.code_hash as string,
        codeSalt: data.code_salt as string,
        accessToken: data.access_token as string,
        refreshToken: data.refresh_token as string,
        attempts: data.attempts as number,
        expiresAt: data.expires_at as string,
      }
    },
    async deleteChallenge(pendingToken) {
      await supabaseAdmin.from('admin_login_challenges').delete().eq('pending_token', pendingToken)
    },
    async incrementAttempts(pendingToken, nextAttempts) {
      await supabaseAdmin.from('admin_login_challenges').update({ attempts: nextAttempts }).eq('pending_token', pendingToken)
    },
  }

  try {
    const result = await handleAdminLoginVerify(body, dataSource)
    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof AdminLoginError) {
      return jsonResponse({ code: err.code, message: err.message, remainingAttempts: err.remainingAttempts }, err.httpStatus)
    }
    console.error('admin-login-verify unexpected error', err)
    return jsonResponse({ code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' }, 500)
  }
})
