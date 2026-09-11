import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const useAdminAuthMock = vi.fn()
const startAdminLoginMock = vi.fn()
const verifyAdminLoginCodeMock = vi.fn()
const setSessionMock = vi.fn()

vi.mock('@/features/admin/AdminAuthContext', () => ({
  useAdminAuth: () => useAdminAuthMock(),
}))

vi.mock('@/features/admin/adminLoginApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/adminLoginApi')>('@/features/admin/adminLoginApi')
  return {
    ...actual,
    startAdminLogin: (...args: unknown[]) => startAdminLoginMock(...args),
    verifyAdminLoginCode: (...args: unknown[]) => verifyAdminLoginCodeMock(...args),
  }
})

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: { setSession: (...args: unknown[]) => setSessionMock(...args) },
  },
}))

const { AdminLoginPage } = await import('./AdminLoginPage')
const { AdminLoginError } = await import('./adminLoginApi')

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminLoginPage />
    </MemoryRouter>,
  )
}

async function fillCredentials(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/email/i), email)
  await user.type(screen.getByLabelText(/password/i), password)
  await user.click(screen.getByRole('button', { name: /sign in/i }))
  return user
}

describe('AdminLoginPage', () => {
  beforeEach(() => {
    useAdminAuthMock.mockReturnValue({
      session: null,
      adminProfile: null,
      loading: false,
      notAuthorized: false,
      suspended: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    })
    startAdminLoginMock.mockReset()
    verifyAdminLoginCodeMock.mockReset()
    setSessionMock.mockReset()
    setSessionMock.mockResolvedValue({ error: null })
  })

  it('never calls verifyAdminLoginCode or setSession before the password step succeeds', async () => {
    startAdminLoginMock.mockRejectedValue(new AdminLoginError('INVALID_CREDENTIALS', 'Incorrect email or password.'))
    renderPage()
    await fillCredentials('admin@bliss.rent', 'wrong-password')

    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument()
    expect(verifyAdminLoginCodeMock).not.toHaveBeenCalled()
    expect(setSessionMock).not.toHaveBeenCalled()
    // Still on the credentials step, not the code step.
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('moves to the code step (never showing a session) once the password step succeeds', async () => {
    startAdminLoginMock.mockResolvedValue({ pendingToken: 'pending-1', maskedEmail: 'a***n@b***t.com', expiresInMinutes: 10 })
    renderPage()
    await fillCredentials('admin@bliss.rent', 'correct-password')

    expect(await screen.findByLabelText(/verification code/i)).toBeInTheDocument()
    expect(screen.getByText(/a\*\*\*n@b\*\*\*t\.com/)).toBeInTheDocument()
    expect(setSessionMock).not.toHaveBeenCalled()
  })

  it('rejects an incorrect code, showing the server message, without ever calling setSession', async () => {
    startAdminLoginMock.mockResolvedValue({ pendingToken: 'pending-1', maskedEmail: 'a***n@b***t.com', expiresInMinutes: 10 })
    verifyAdminLoginCodeMock.mockRejectedValue(
      new AdminLoginError('INVALID_CODE', 'Incorrect code. 3 attempts remaining.', 3),
    )
    renderPage()
    const user = await fillCredentials('admin@bliss.rent', 'correct-password')
    await screen.findByLabelText(/verification code/i)

    await user.type(screen.getByLabelText(/verification code/i), '000000')
    await user.click(screen.getByRole('button', { name: /verify & sign in/i }))

    expect(await screen.findByText('Incorrect code. 3 attempts remaining.')).toBeInTheDocument()
    expect(setSessionMock).not.toHaveBeenCalled()
  })

  it('applies the real session with setSession only after the code verifies correctly', async () => {
    startAdminLoginMock.mockResolvedValue({ pendingToken: 'pending-1', maskedEmail: 'a***n@b***t.com', expiresInMinutes: 10 })
    verifyAdminLoginCodeMock.mockResolvedValue({ accessToken: 'access-abc', refreshToken: 'refresh-xyz' })
    renderPage()
    const user = await fillCredentials('admin@bliss.rent', 'correct-password')
    await screen.findByLabelText(/verification code/i)

    await user.type(screen.getByLabelText(/verification code/i), '123456')
    await user.click(screen.getByRole('button', { name: /verify & sign in/i }))

    await waitFor(() =>
      expect(setSessionMock).toHaveBeenCalledWith({ access_token: 'access-abc', refresh_token: 'refresh-xyz' }),
    )
    expect(verifyAdminLoginCodeMock).toHaveBeenCalledWith('pending-1', '123456')
  })

  it('"Start over" returns to the credentials step and clears the code', async () => {
    startAdminLoginMock.mockResolvedValue({ pendingToken: 'pending-1', maskedEmail: 'a***n@b***t.com', expiresInMinutes: 10 })
    renderPage()
    const user = await fillCredentials('admin@bliss.rent', 'correct-password')
    await screen.findByLabelText(/verification code/i)

    await user.click(screen.getByRole('button', { name: /start over/i }))

    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument()
  })

  it('redirects to the dashboard once a real admin session and profile are present', () => {
    useAdminAuthMock.mockReturnValue({
      session: { user: { id: 'u1' } },
      adminProfile: { id: 'u1', full_name: 'Staff', role: 'staff', is_active: true },
      loading: false,
      notAuthorized: false,
      suspended: false,
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
    })
    renderPage()
    expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument()
  })
})
