// Pure, framework-free request handler for the admin-create-staff Edge
// Function. See create-booking/logic.ts for the same split rationale
// (this file has zero Deno-specific imports, so it runs directly under
// vitest in logic.test.ts).
//
// Provisioning a staff login needs two service-role-only operations the
// browser can never be trusted to do directly: creating a Supabase Auth
// user, and writing the matching admin_profiles row. This function is the
// only place both happen together, and it starts by re-verifying — from
// the caller's own access token, server-side — that the caller is an
// active super_admin, exactly like admin_profiles' RLS policies would
// (see supabase/migrations/20260901000000_staff_account_control.sql).
// If step 2 fails after step 1 already created the auth user, that user
// is deleted again so we never leave an orphaned login with no profile.
//
// This endpoint only ever creates 'staff' accounts. Promoting an existing
// account to super_admin is a separate, deliberate action taken from the
// Staff Accounts screen afterwards (src/features/admin/staff) — never a
// side effect of account creation.

export type CreateStaffErrorCode = 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'EMAIL_TAKEN' | 'SERVER_ERROR'

export class CreateStaffError extends Error {
  code: CreateStaffErrorCode
  httpStatus: number
  fieldErrors?: Record<string, string>

  constructor(code: CreateStaffErrorCode, message: string, httpStatus: number, fieldErrors?: Record<string, string>) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
    this.fieldErrors = fieldErrors
  }
}

export interface CreateStaffRequestBody {
  fullName?: string
  email?: string
  password?: string
}

export interface CreateStaffResult {
  id: string
  fullName: string
  email: string
  role: 'staff'
}

export interface CallerProfile {
  role: string
  is_active: boolean
}

export interface CreateStaffDeps {
  /** Resolves the caller's user id from their access token, or null if the token is missing/invalid/expired. */
  getCallerUserId(accessToken: string): Promise<string | null>
  getCallerProfile(id: string): Promise<CallerProfile | null>
  createAuthUser(email: string, password: string): Promise<{ id: string } | { error: string }>
  insertStaffProfile(id: string, fullName: string): Promise<{ ok: true } | { error: string }>
  deleteAuthUser(id: string): Promise<void>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function handleCreateStaff(
  authHeader: string | null,
  body: CreateStaffRequestBody,
  deps: CreateStaffDeps,
): Promise<CreateStaffResult> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw new CreateStaffError('UNAUTHORIZED', 'You must be signed in to do that.', 401)
  }

  const callerId = await deps.getCallerUserId(token)
  if (!callerId) {
    throw new CreateStaffError('UNAUTHORIZED', 'Your session has expired. Please sign in again.', 401)
  }

  const callerProfile = await deps.getCallerProfile(callerId)
  if (!callerProfile || callerProfile.role !== 'super_admin' || !callerProfile.is_active) {
    throw new CreateStaffError('FORBIDDEN', 'Only the owner account can add staff members.', 403)
  }

  const fullName = (body.fullName ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''

  const fieldErrors: Record<string, string> = {}
  if (!fullName) fieldErrors.fullName = 'Full name is required.'
  if (!email || !EMAIL_RE.test(email)) fieldErrors.email = 'Enter a valid email address.'
  if (password.length < 8) fieldErrors.password = 'Password must be at least 8 characters.'
  if (Object.keys(fieldErrors).length > 0) {
    throw new CreateStaffError('VALIDATION_ERROR', 'Please fix the highlighted fields.', 422, fieldErrors)
  }

  const created = await deps.createAuthUser(email, password)
  if ('error' in created) {
    if (/registered|already exists|duplicate/i.test(created.error)) {
      throw new CreateStaffError('EMAIL_TAKEN', 'An account with this email already exists.', 409)
    }
    throw new CreateStaffError('SERVER_ERROR', 'Could not create the staff login. Please try again.', 500)
  }

  const inserted = await deps.insertStaffProfile(created.id, fullName)
  if ('error' in inserted) {
    await deps.deleteAuthUser(created.id)
    throw new CreateStaffError(
      'SERVER_ERROR',
      'Could not finish setting up the staff account. Please try again.',
      500,
    )
  }

  return { id: created.id, fullName, email, role: 'staff' }
}
