import { describe, it, expect, vi } from 'vitest'
import { handleAdminLoginStart, type AdminLoginDataSource, type AuthClientLike } from './logic.ts'
import { AdminLoginError } from '../_shared/adminLoginCode.ts'

const SIGNED_IN_SESSION = {
  accessToken: 'access-token-abc',
  refreshToken: 'refresh-token-xyz',
  userId: 'admin-1',
  email: 'jane@example.com',
}

function buildDeps(overrides?: {
  authOk?: boolean
  profile?: { id: string; isActive: boolean } | null
  sendLoginCodeError?: Error
}) {
  const authClient: AuthClientLike = {
    signInWithPassword: vi.fn(async () =>
      overrides?.authOk === false ? { ok: false as const } : { ok: true as const, session: SIGNED_IN_SESSION },
    ),
  }

  const insertChallenge = vi.fn(async () => ({ pendingToken: 'pending-token-123' }))
  const deleteChallengesForAdmin = vi.fn(async () => {})
  const deleteExpiredChallenges = vi.fn(async () => {})

  const dataSource: AdminLoginDataSource = {
    getAdminProfile: vi.fn(async () =>
      overrides?.profile !== undefined ? overrides.profile : { id: 'admin-1', isActive: true },
    ),
    deleteChallengesForAdmin,
    deleteExpiredChallenges,
    insertChallenge,
  }

  const sendLoginCode = vi.fn(async () => {
    if (overrides?.sendLoginCodeError) throw overrides.sendLoginCodeError
  })

  return { authClient, dataSource, sendLoginCode, insertChallenge, deleteChallengesForAdmin, deleteExpiredChallenges }
}

describe('handleAdminLoginStart', () => {
  it('rejects a request missing email or password without touching auth', async () => {
    const deps = buildDeps()
    await expect(handleAdminLoginStart({ email: '', password: 'x' }, deps)).rejects.toThrow(AdminLoginError)
    expect(deps.authClient.signInWithPassword).not.toHaveBeenCalled()
  })

  it('returns a generic INVALID_CREDENTIALS error on a failed sign-in, never distinguishing email vs password', async () => {
    const deps = buildDeps({ authOk: false })
    await expect(handleAdminLoginStart({ email: 'jane@example.com', password: 'wrong' }, deps)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
  })

  it('rejects with NOT_AUTHORIZED when the signed-in user has no admin_profiles row', async () => {
    const deps = buildDeps({ profile: null })
    await expect(handleAdminLoginStart({ email: 'jane@example.com', password: 'x' }, deps)).rejects.toMatchObject({
      code: 'NOT_AUTHORIZED',
    })
    // No challenge should ever be created for a non-admin account.
    expect(deps.insertChallenge).not.toHaveBeenCalled()
  })

  it('rejects with SUSPENDED when the admin_profiles row is inactive', async () => {
    const deps = buildDeps({ profile: { id: 'admin-1', isActive: false } })
    await expect(handleAdminLoginStart({ email: 'jane@example.com', password: 'x' }, deps)).rejects.toMatchObject({
      code: 'SUSPENDED',
    })
    expect(deps.insertChallenge).not.toHaveBeenCalled()
  })

  it('on valid credentials, clears any prior pending challenge for this admin before creating a new one', async () => {
    const deps = buildDeps()
    await handleAdminLoginStart({ email: 'jane@example.com', password: 'x' }, deps)

    expect(deps.deleteExpiredChallenges).toHaveBeenCalled()
    expect(deps.deleteChallengesForAdmin).toHaveBeenCalledWith('admin-1')
    expect(deps.insertChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ adminUserId: 'admin-1', accessToken: 'access-token-abc', refreshToken: 'refresh-token-xyz' }),
    )
  })

  it('emails the code to the signed-in address and returns only an opaque pendingToken — never the code or the session tokens', async () => {
    const deps = buildDeps()
    const result = await handleAdminLoginStart({ email: 'jane@example.com', password: 'x' }, deps)

    expect(deps.sendLoginCode).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@example.com', code: expect.stringMatching(/^\d{6}$/) }),
    )
    expect(result.pendingToken).toBe('pending-token-123')
    expect(result).not.toHaveProperty('accessToken')
    expect(result).not.toHaveProperty('refreshToken')
    expect(result).not.toHaveProperty('code')
  })

  it('masks the email in the result rather than returning it in full', async () => {
    const deps = buildDeps()
    const result = await handleAdminLoginStart({ email: 'jane@example.com', password: 'x' }, deps)
    expect(result.maskedEmail).not.toBe('jane@example.com')
    expect(result.maskedEmail).toContain('@')
  })

  it('discards the just-created challenge and surfaces EMAIL_FAILED when sending the code throws', async () => {
    const deps = buildDeps({ sendLoginCodeError: new Error('Resend down') })
    await expect(handleAdminLoginStart({ email: 'jane@example.com', password: 'x' }, deps)).rejects.toMatchObject({
      code: 'EMAIL_FAILED',
    })
    // Cleaned up so no orphaned, un-retrievable code is left sitting in the table.
    expect(deps.deleteChallengesForAdmin).toHaveBeenCalledWith('admin-1')
  })
})
