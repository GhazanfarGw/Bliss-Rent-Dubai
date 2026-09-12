// Staff Account Control — admin-create-staff Edge Function.
//
// Provisions a new staff login: creates the Supabase Auth user and the
// matching admin_profiles row together, using the service-role key the
// browser is never given. See logic.ts for why this can't be a plain
// client-side call, and for the full validation/rollback behavior.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  handleCreateStaff,
  CreateStaffError,
  type CreateStaffRequestBody,
  type CreateStaffDeps,
} from './logic.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, 405)
  }

  let body: CreateStaffRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ code: 'VALIDATION_ERROR', message: 'Request body must be JSON.' }, 400)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const deps: CreateStaffDeps = {
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
    async createAuthUser(email, password) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error || !data.user) return { error: error?.message ?? 'Could not create user.' }
      return { id: data.user.id }
    },
    async insertStaffProfile(id, fullName) {
      const { error } = await supabaseAdmin.from('admin_profiles').insert({ id, full_name: fullName, role: 'staff' })
      if (error) return { error: error.message }
      return { ok: true }
    },
    async deleteAuthUser(id) {
      await supabaseAdmin.auth.admin.deleteUser(id)
    },
  }

  try {
    const result = await handleCreateStaff(req.headers.get('Authorization'), body, deps)
    return jsonResponse(result, 201)
  } catch (err) {
    if (err instanceof CreateStaffError) {
      return jsonResponse({ code: err.code, message: err.message, fieldErrors: err.fieldErrors }, err.httpStatus)
    }
    console.error('admin-create-staff unexpected error', err)
    return jsonResponse(
      { code: 'SERVER_ERROR', message: 'Something went wrong while creating the staff account. Please try again.' },
      500,
    )
  }
})
