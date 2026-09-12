// Pure, framework-free request handler for the admin-login-start Edge
// Function. index.ts is the only file in this directory that touches
// Deno-specific APIs (Deno.serve, Deno.env) or a real Supabase client —
// everything that matters is here, unit-testable under Vitest with
// mocked dependencies, exactly like create-booking/logic.ts.
//
// STEP 1 of 2 in the mandatory admin email-verification login (owner
// request, 2026-09-05 — confirmed via AskUserQuestion: real enforcement,
// applies to every admin). This is the ONLY place an admin's password is
// ever checked. On success it does NOT return a usable session — see the
// file header on 20260919000000_admin_login_email_verification.sql for
// why: the real Supabase Auth tokens are held server-side (in
// admin_login_challenges) and only released by admin-login-verify once
// the emailed code is confirmed.
import {
  AdminLoginError,
  generateNumericCode,
  generateSalt,
  hashCode,
  CODE_TTL_MINUTES,
} from '../_shared/adminLoginCode.ts'

export interface AdminLoginStartBody {
  email?: string
  password?: string
}

export interface AdminLoginStartResult {
  pendingToken: string
  maskedEmail: string
  expiresInMinutes: number
}

export interface SignedInSession {
  accessToken: string
  refreshToken: string
  userId: string
  email: string
}

/** The minimal slice of supabase-js's auth client this needs — real signInWithPassword() in index.ts, a scripted fake in tests. */
export interface AuthClientLike {
  signInWithPassword(email: string, password: string): Promise<{ ok: true; session: SignedInSession } | { ok: false }>
}

export interface AdminProfileRow {
  id: string
  isActive: boolean
}

export interface AdminLoginDataSource {
  getAdminProfile(userId: string): Promise<AdminProfileRow | null>
  /** Only one pending code per admin at a time — a fresh login attempt invalidates any earlier unclaimed one. */
  deleteChallengesForAdmin(adminUserId: string): Promise<void>
  /** Opportunistic sweep — no cron job backs this table; every call to this function cleans up whatever's already expired. */
  deleteExpiredChallenges(): Promise<void>
  insertChallenge(input: {
    adminUserId: string
    codeHash: string
    codeSalt: string
    accessToken: string
    refreshToken: string
    expiresAt: string
  }): Promise<{ pendingToken: string }>
}

export interface SendLoginCodeFn {
  (args: { email: string; code: string }): Promise<void>
}

export interface AdminLoginStartDeps {
  authClient: AuthClientLike
  dataSource: AdminLoginDataSource
  /** Throws on failure — unlike a best-effort confirmation email, a login the admin can't retrieve the code for is useless, so the caller must surface this as a real error rather than silently continuing. */
  sendLoginCode: SendLoginCodeFn
}

export async function handleAdminLoginStart(
  body: AdminLoginStartBody,
  deps: AdminLoginStartDeps,
): Promise<AdminLoginStartResult> {
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    throw new AdminLoginError('VALIDATION_ERROR', 'Please enter your email and password.', 422)
  }

  const signIn = await deps.authClient.signInWithPassword(email, password)
  if (!signIn.ok) {
    // Deliberately the same generic message whether the email doesn't
    // exist or the password is wrong — never reveal which, same
    // indistinguishable-failure convention as lookupBooking/verify flows
    // elsewhere in this codebase.
    throw new AdminLoginError('INVALID_CREDENTIALS', 'Incorrect email or password.', 401)
  }

  const profile = await deps.dataSource.getAdminProfile(signIn.session.userId)
  if (!profile) {
    throw new AdminLoginError('NOT_AUTHORIZED', 'This account does not have admin dashboard access.', 403)
  }
  if (!profile.isActive) {
    throw new AdminLoginError('SUSPENDED', 'This admin account has been suspended.', 403)
  }

  await deps.dataSource.deleteExpiredChallenges()
  await deps.dataSource.deleteChallengesForAdmin(signIn.session.userId)

  const code = generateNumericCode()
  const salt = generateSalt()
  const codeHash = await hashCode(code, salt)
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString()

  const { pendingToken } = await deps.dataSource.insertChallenge({
    adminUserId: signIn.session.userId,
    codeHash,
    codeSalt: salt,
    accessToken: signIn.session.accessToken,
    refreshToken: signIn.session.refreshToken,
    expiresAt,
  })

  try {
    await deps.sendLoginCode({ email: signIn.session.email, code })
  } catch {
    // Without the email actually landing, this pending login can never
    // be completed — don't leave an orphaned, guessable challenge row
    // sitting in the table, and tell the admin plainly rather than
    // pretending a code is on its way.
    await deps.dataSource.deleteChallengesForAdmin(signIn.session.userId)
    throw new AdminLoginError('EMAIL_FAILED', 'We could not send your verification code. Please try again.', 500)
  }

  return { pendingToken, maskedEmail: maskEmail(signIn.session.email), expiresInMinutes: CODE_TTL_MINUTES }
}

/** "j***y@e***e.com" style masking for the "we sent a code to ___" confirmation text — never the full address, but recognizable enough that the admin can tell it went to the right inbox. */
function maskEmail(email: string): string {
  const atIndex = email.indexOf('@')
  if (atIndex <= 0) return email
  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)
  const dotIndex = domain.indexOf('.')
  const domainHead = dotIndex > 0 ? domain.slice(0, dotIndex) : domain
  const domainRest = dotIndex > 0 ? domain.slice(dotIndex) : ''

  const maskedLocal = maskMiddle(local)
  const maskedDomainHead = maskMiddle(domainHead)
  return `${maskedLocal}@${maskedDomainHead}${domainRest}`
}

function maskMiddle(value: string): string {
  if (value.length <= 2) return value[0] + '*'
  return value[0] + '*'.repeat(value.length - 2) + value.slice(-1)
}
