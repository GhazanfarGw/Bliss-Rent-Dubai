import { describe, it, expect, vi } from 'vitest'
import { handleAdminLoginVerify, type AdminLoginVerifyDataSource, type ChallengeRow } from './logic.ts'
import { hashCode, generateSalt } from '../_shared/adminLoginCode.ts'

const NOW = new Date('2026-09-05T12:00:00.000Z')
const FUTURE = new Date('2026-09-05T12:09:00.000Z').toISOString()
const PAST = new Date('2026-09-05T11:00:00.000Z').toISOString()

async function buildChallenge(overrides?: Partial<ChallengeRow>): Promise<ChallengeRow> {
  const salt = generateSalt()
  const codeHash = await hashCode('654321', salt)
  return {
    adminUserId: 'admin-1',
    codeHash,
    codeSalt: salt,
    accessToken: 'access-token-abc',
    refreshToken: 'refresh-token-xyz',
    attempts: 0,
    expiresAt: FUTURE,
    ...overrides,
  }
}

function buildDataSource(challenge: ChallengeRow | null) {
  const deleteChallenge = vi.fn(async () => {})
  const incrementAttempts = vi.fn(async () => {})
  const dataSource: AdminLoginVerifyDataSource = {
    getChallenge: vi.fn(async () => challenge),
    deleteChallenge,
    incrementAttempts,
  }
  return { dataSource, deleteChallenge, incrementAttempts }
}

describe('handleAdminLoginVerify', () => {
  it('rejects a malformed request (missing token or non-6-digit code) before touching the data source', async () => {
    const { dataSource } = buildDataSource(null)
    await expect(handleAdminLoginVerify({ pendingToken: '', code: '123456' }, dataSource, NOW)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
    await expect(handleAdminLoginVerify({ pendingToken: 'tok', code: '12' }, dataSource, NOW)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
    expect(dataSource.getChallenge).not.toHaveBeenCalled()
  })

  it('rejects with CODE_EXPIRED when no challenge exists for the pendingToken', async () => {
    const { dataSource } = buildDataSource(null)
    await expect(handleAdminLoginVerify({ pendingToken: 'tok', code: '654321' }, dataSource, NOW)).rejects.toMatchObject({
      code: 'CODE_EXPIRED',
    })
  })

  it('rejects with CODE_EXPIRED and deletes the row once expires_at has passed', async () => {
    const challenge = await buildChallenge({ expiresAt: PAST })
    const { dataSource, deleteChallenge } = buildDataSource(challenge)
    await expect(handleAdminLoginVerify({ pendingToken: 'tok', code: '654321' }, dataSource, NOW)).rejects.toMatchObject({
      code: 'CODE_EXPIRED',
    })
    expect(deleteChallenge).toHaveBeenCalledWith('tok')
  })

  it('rejects with TOO_MANY_ATTEMPTS and deletes the row once attempts already reached the max', async () => {
    const challenge = await buildChallenge({ attempts: 5 })
    const { dataSource, deleteChallenge } = buildDataSource(challenge)
    await expect(handleAdminLoginVerify({ pendingToken: 'tok', code: '654321' }, dataSource, NOW)).rejects.toMatchObject({
      code: 'TOO_MANY_ATTEMPTS',
    })
    expect(deleteChallenge).toHaveBeenCalledWith('tok')
  })

  it('increments attempts and reports remaining tries on an incorrect code, without deleting the row', async () => {
    const challenge = await buildChallenge({ attempts: 1 })
    const { dataSource, incrementAttempts, deleteChallenge } = buildDataSource(challenge)
    await expect(handleAdminLoginVerify({ pendingToken: 'tok', code: '000000' }, dataSource, NOW)).rejects.toMatchObject({
      code: 'INVALID_CODE',
      remainingAttempts: 3,
    })
    expect(incrementAttempts).toHaveBeenCalledWith('tok', 2)
    expect(deleteChallenge).not.toHaveBeenCalled()
  })

  it('deletes the row on the attempt that reaches MAX_ATTEMPTS, reporting TOO_MANY_ATTEMPTS instead of INVALID_CODE', async () => {
    const challenge = await buildChallenge({ attempts: 4 })
    const { dataSource, deleteChallenge, incrementAttempts } = buildDataSource(challenge)
    await expect(handleAdminLoginVerify({ pendingToken: 'tok', code: '000000' }, dataSource, NOW)).rejects.toMatchObject({
      code: 'TOO_MANY_ATTEMPTS',
    })
    expect(deleteChallenge).toHaveBeenCalledWith('tok')
    expect(incrementAttempts).not.toHaveBeenCalled()
  })

  it('returns the held session tokens and deletes the (single-use) row on a correct code', async () => {
    const challenge = await buildChallenge()
    const { dataSource, deleteChallenge } = buildDataSource(challenge)
    const result = await handleAdminLoginVerify({ pendingToken: 'tok', code: '654321' }, dataSource, NOW)

    expect(result).toEqual({ accessToken: 'access-token-abc', refreshToken: 'refresh-token-xyz' })
    expect(deleteChallenge).toHaveBeenCalledWith('tok')
  })
})
