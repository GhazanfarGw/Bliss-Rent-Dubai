// Pure, framework-free request handler for the admin-login-verify Edge
// Function. See admin-login-start/logic.ts for the overall design.
//
// STEP 2 of 2. This is the ONLY place the emailed code is ever checked,
// and the ONLY place the real Supabase Auth session tokens are ever
// handed back to a browser for this login. Single-use: whether the code
// matches or not, this always mutates or deletes the challenge row so
// the same pendingToken+code pair can never be replayed.
import { AdminLoginError, hashCode, constantTimeEqual, MAX_ATTEMPTS } from '../_shared/adminLoginCode.ts'

export interface AdminLoginVerifyBody {
  pendingToken?: string
  code?: string
}

export interface AdminLoginVerifyResult {
  accessToken: string
  refreshToken: string
}

export interface ChallengeRow {
  adminUserId: string
  codeHash: string
  codeSalt: string
  accessToken: string
  refreshToken: string
  attempts: number
  /** ISO timestamp. */
  expiresAt: string
}

export interface AdminLoginVerifyDataSource {
  getChallenge(pendingToken: string): Promise<ChallengeRow | null>
  deleteChallenge(pendingToken: string): Promise<void>
  incrementAttempts(pendingToken: string, nextAttempts: number): Promise<void>
}

const CODE_RE = /^\d{6}$/

const EXPIRED_MESSAGE = 'This code has expired. Please sign in again.'
const TOO_MANY_ATTEMPTS_MESSAGE = 'Too many incorrect attempts. Please sign in again.'

export async function handleAdminLoginVerify(
  body: AdminLoginVerifyBody,
  dataSource: AdminLoginVerifyDataSource,
  now: Date = new Date(),
): Promise<AdminLoginVerifyResult> {
  const pendingToken = typeof body.pendingToken === 'string' ? body.pendingToken.trim() : ''
  const code = typeof body.code === 'string' ? body.code.trim() : ''

  if (!pendingToken || !CODE_RE.test(code)) {
    throw new AdminLoginError('VALIDATION_ERROR', 'Please enter the 6-digit code.', 422)
  }

  const challenge = await dataSource.getChallenge(pendingToken)
  if (!challenge) {
    // Covers "never existed", "already consumed", and "already deleted
    // after attempt exhaustion" alike — no need to distinguish those to
    // the caller, the remedy is the same either way: sign in again.
    throw new AdminLoginError('CODE_EXPIRED', EXPIRED_MESSAGE, 401)
  }

  if (new Date(challenge.expiresAt).getTime() < now.getTime()) {
    await dataSource.deleteChallenge(pendingToken)
    throw new AdminLoginError('CODE_EXPIRED', EXPIRED_MESSAGE, 401)
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    await dataSource.deleteChallenge(pendingToken)
    throw new AdminLoginError('TOO_MANY_ATTEMPTS', TOO_MANY_ATTEMPTS_MESSAGE, 401)
  }

  const candidateHash = await hashCode(code, challenge.codeSalt)
  if (!constantTimeEqual(candidateHash, challenge.codeHash)) {
    const nextAttempts = challenge.attempts + 1
    if (nextAttempts >= MAX_ATTEMPTS) {
      await dataSource.deleteChallenge(pendingToken)
      throw new AdminLoginError('TOO_MANY_ATTEMPTS', TOO_MANY_ATTEMPTS_MESSAGE, 401)
    }
    await dataSource.incrementAttempts(pendingToken, nextAttempts)
    const remaining = MAX_ATTEMPTS - nextAttempts
    throw new AdminLoginError(
      'INVALID_CODE',
      remaining === 1 ? 'Incorrect code. 1 attempt remaining.' : `Incorrect code. ${remaining} attempts remaining.`,
      401,
      remaining,
    )
  }

  // Correct code: single-use, so this pending login can never be
  // replayed even if the same request were somehow sent twice.
  await dataSource.deleteChallenge(pendingToken)
  return { accessToken: challenge.accessToken, refreshToken: challenge.refreshToken }
}
