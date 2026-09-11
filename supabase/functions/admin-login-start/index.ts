// Admin dashboard login, step 1 of 2 — checks the password and emails a
// verification code. Runs with the SERVICE ROLE key for the
// admin_login_challenges read/write (that table has zero RLS policies —
// see the migration), but the password check itself goes through a
// SEPARATE client using the public ANON key, calling
// supabase.auth.signInWithPassword() exactly the way the browser used to
// call it directly before this change. The resulting session tokens are
// never returned to the browser from here — only an opaque pendingToken
// is. See ./logic.ts for the full design rationale.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  handleAdminLoginStart,
  type AdminLoginStartBody,
  type AuthClientLike,
  type AdminLoginDataSource,
} from './logic.ts'
import { AdminLoginError, CODE_TTL_MINUTES } from '../_shared/adminLoginCode.ts'
import { renderAdminLoginCodeEmail } from '../_shared/email/adminLoginCodeEmail.ts'
import { sendViaResend } from '../_shared/email/resendProvider.ts'
import { getResendSenderConfig } from '../_shared/email/emailSenderConfig.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: AdminLoginStartBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ code: 'VALIDATION_ERROR', message: 'Request body must be JSON.' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  // SUPABASE_ANON_KEY is one of the reserved secrets Supabase injects
  // into every Edge Function automatically — never configured manually,
  // and safe to use here for the exact same reason it's safe in the
  // browser (RLS protects every table it can reach).
  const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '')
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  const authClient: AuthClientLike = {
    async signInWithPassword(email, password) {
      const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password })
      if (error || !data.session || !data.user) return { ok: false }
      return {
        ok: true,
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          userId: data.user.id,
          email: data.user.email ?? email,
        },
      }
    },
  }

  const dataSource: AdminLoginDataSource = {
    async getAdminProfile(userId) {
      const { data, error } = await supabaseAdmin
        .from('admin_profiles')
        .select('id, is_active')
        .eq('id', userId)
        .maybeSingle()
      if (error || !data) return null
      return { id: data.id as string, isActive: data.is_active as boolean }
    },
    async deleteChallengesForAdmin(adminUserId) {
      await supabaseAdmin.from('admin_login_challenges').delete().eq('admin_user_id', adminUserId)
    },
    async deleteExpiredChallenges() {
      await supabaseAdmin.from('admin_login_challenges').delete().lt('expires_at', new Date().toISOString())
    },
    async insertChallenge(input) {
      const { data, error } = await supabaseAdmin
        .from('admin_login_challenges')
        .insert({
          admin_user_id: input.adminUserId,
          code_hash: input.codeHash,
          code_salt: input.codeSalt,
          access_token: input.accessToken,
          refresh_token: input.refreshToken,
          expires_at: input.expiresAt,
        })
        .select('pending_token')
        .single()
      if (error || !data) throw new Error(error?.message ?? 'Failed to create the login challenge.')
      return { pendingToken: data.pending_token as string }
    },
  }

  try {
    const result = await handleAdminLoginStart(body, {
      authClient,
      dataSource,
      async sendLoginCode({ email, code }) {
        // Phase 9's admin sender config, reused as-is — this email goes
        // TO an admin, exactly like every other admin operational email.
        const senderConfig = getResendSenderConfig('admin', Deno.env)
        const content = renderAdminLoginCodeEmail('en', code, CODE_TTL_MINUTES)
        const sendResult = await sendViaResend(senderConfig, { to: email, subject: content.subject, html: content.html })
        if (!sendResult.ok) throw new Error(sendResult.errorMessage ?? 'Email send failed.')
      },
    })
    return jsonResponse(result, 200)
  } catch (err) {
    if (err instanceof AdminLoginError) {
      return jsonResponse({ code: err.code, message: err.message }, err.httpStatus)
    }
    console.error('admin-login-start unexpected error', err)
    return jsonResponse({ code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' }, 500)
  }
})
