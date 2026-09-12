import { describe, it, expect, vi } from 'vitest'
import { handleCreateStaff, CreateStaffError, type CreateStaffDeps } from './logic.ts'

function fakeDeps(overrides: Partial<CreateStaffDeps> = {}): CreateStaffDeps {
  return {
    getCallerUserId: vi.fn(async () => 'owner-1'),
    getCallerProfile: vi.fn(async () => ({ role: 'super_admin', is_active: true })),
    createAuthUser: vi.fn(async () => ({ id: 'new-user-1' })),
    insertStaffProfile: vi.fn(async () => ({ ok: true as const })),
    deleteAuthUser: vi.fn(async () => undefined),
    ...overrides,
  }
}

const VALID_BODY = { fullName: 'Amina Yousef', email: 'amina@example.com', password: 'correct-horse' }

describe('handleCreateStaff', () => {
  it('rejects a missing Authorization header without checking anything else', async () => {
    const deps = fakeDeps()
    await expect(handleCreateStaff(null, VALID_BODY, deps)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    expect(deps.getCallerUserId).not.toHaveBeenCalled()
  })

  it('rejects an expired/invalid access token', async () => {
    const deps = fakeDeps({ getCallerUserId: vi.fn(async () => null) })
    await expect(handleCreateStaff('Bearer bad-token', VALID_BODY, deps)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('rejects a caller with no admin_profiles row', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => null) })
    await expect(handleCreateStaff('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a staff caller — only super_admin may create staff accounts', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => ({ role: 'staff', is_active: true })) })
    await expect(handleCreateStaff('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a suspended super_admin caller', async () => {
    const deps = fakeDeps({ getCallerProfile: vi.fn(async () => ({ role: 'super_admin', is_active: false })) })
    await expect(handleCreateStaff('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('returns field-level validation errors for a missing name, bad email, and short password', async () => {
    const deps = fakeDeps()
    try {
      await handleCreateStaff('Bearer t', { fullName: '', email: 'not-an-email', password: 'short' }, deps)
      expect.fail('expected handleCreateStaff to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(CreateStaffError)
      const apiErr = err as CreateStaffError
      expect(apiErr.code).toBe('VALIDATION_ERROR')
      expect(apiErr.fieldErrors).toMatchObject({
        fullName: expect.any(String),
        email: expect.any(String),
        password: expect.any(String),
      })
    }
    expect(deps.createAuthUser).not.toHaveBeenCalled()
  })

  it('maps a duplicate-email failure from auth.admin.createUser to EMAIL_TAKEN', async () => {
    const deps = fakeDeps({
      createAuthUser: vi.fn(async () => ({ error: 'A user with this email address has already been registered' })),
    })
    await expect(handleCreateStaff('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
    expect(deps.insertStaffProfile).not.toHaveBeenCalled()
  })

  it('rolls back the auth user if the admin_profiles insert fails', async () => {
    const deps = fakeDeps({
      insertStaffProfile: vi.fn(async () => ({ error: 'insert failed' })),
    })
    await expect(handleCreateStaff('Bearer t', VALID_BODY, deps)).rejects.toMatchObject({ code: 'SERVER_ERROR' })
    expect(deps.deleteAuthUser).toHaveBeenCalledWith('new-user-1')
  })

  it('creates the staff account end to end for a valid super_admin request', async () => {
    const deps = fakeDeps()
    const result = await handleCreateStaff('Bearer t', VALID_BODY, deps)
    expect(result).toEqual({
      id: 'new-user-1',
      fullName: 'Amina Yousef',
      email: 'amina@example.com',
      role: 'staff',
    })
    expect(deps.createAuthUser).toHaveBeenCalledWith('amina@example.com', 'correct-horse')
    expect(deps.insertStaffProfile).toHaveBeenCalledWith('new-user-1', 'Amina Yousef')
    expect(deps.deleteAuthUser).not.toHaveBeenCalled()
  })
})
