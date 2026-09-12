import { supabase } from '@/lib/supabaseClient'

/**
 * Frontend client for the two-step admin login (2026-09-05 — mandatory
 * emailed verification code, confirmed via AskUserQuestion: real
 * enforcement, applies to every admin). Neither call touches
 * supabase.auth.signInWithPassword directly anymore — see
 * supabase/functions/admin-login-start/logic.ts for why: the real
 * session tokens are withheld server-side until verifyAdminLoginCode
 * succeeds, at which point the caller (AdminLoginPage.tsx) applies them
 * with supabase.auth.setSession().
 */
export class AdminLoginError extends Error {
  code: string
  remainingAttempts?: number
  constructor(code: string, message: string, remainingAttempts?: number) {
    super(message)
    this.code = code
    this.remainingAttempts = remainingAttempts
  }
}

export interface AdminLoginStartResult {
  pendingToken: string
  maskedEmail: string
  expiresInMinutes: number
}

export interface AdminLoginSessionTokens {
  accessToken: string
  refreshToken: string
}

export async function startAdminLogin(email: string, password: string): Promise<AdminLoginStartResult> {
  const { data, error } = await supabase.functions.invoke('admin-login-start', {
    body: { email, password },
  })
  if (error) throw await toAdminLoginError(error)
  return data as AdminLoginStartResult
}

export async function verifyAdminLoginCode(pendingToken: string, code: string): Promise<AdminLoginSessionTokens> {
  const { data, error } = await supabase.functions.invoke('admin-login-verify', {
    body: { pendingToken, code },
  })
  if (error) throw await toAdminLoginError(error)
  const result = data as { accessToken: string; refreshToken: string }
  return result
}

async function toAdminLoginError(error: unknown): Promise<AdminLoginError> {
  const context = (error as { context?: Response }).context
  if (context) {
    try {
      const parsed = await context.clone().json()
      return new AdminLoginError(
        typeof parsed.code === 'string' ? parsed.code : 'SERVER_ERROR',
        typeof parsed.message === 'string' ? parsed.message : 'Something went wrong.',
        typeof parsed.remainingAttempts === 'number' ? parsed.remainingAttempts : undefined,
      )
    } catch {
      // fall through to the generic case below
    }
  }
  return new AdminLoginError('SERVER_ERROR', error instanceof Error ? error.message : 'Something went wrong.')
}
