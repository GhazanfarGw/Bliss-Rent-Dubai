import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { StaffAccountsPage } from './StaffAccountsPage'
import { AdminApiError } from '@/features/admin/adminApi'

const fetchStaffDirectoryMock = vi.fn()
const setStaffActiveMock = vi.fn()
const setStaffRoleMock = vi.fn()
const createStaffAccountMock = vi.fn()

vi.mock('./staffApi', async () => {
  const actual = await vi.importActual<typeof import('./staffApi')>('./staffApi')
  return {
    ...actual,
    fetchStaffDirectory: (...args: unknown[]) => fetchStaffDirectoryMock(...args),
    setStaffActive: (...args: unknown[]) => setStaffActiveMock(...args),
    setStaffRole: (...args: unknown[]) => setStaffRoleMock(...args),
    createStaffAccount: (...args: unknown[]) => createStaffAccountMock(...args),
  }
})

vi.mock('@/features/admin/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    adminProfile: { id: 'owner-1', full_name: 'Jane Owner', role: 'super_admin', is_active: true, created_at: '2026-01-01' },
  }),
}))

const OWNER = { id: 'owner-1', full_name: 'Jane Owner', role: 'super_admin', is_active: true, created_at: '2026-01-01' }
const STAFF = { id: 'staff-1', full_name: 'Sam Staff', role: 'staff', is_active: true, created_at: '2026-02-02' }
const SUSPENDED = { id: 'staff-2', full_name: 'Alex Away', role: 'staff', is_active: false, created_at: '2026-03-03' }

/**
 * Covers the Staff Account Control screen: the directory renders, the
 * current owner's own row has no action buttons (self-changes are also
 * blocked server-side — see the guard trigger in
 * supabase/migrations/20260901000000_staff_account_control.sql), and every
 * action requires an explicit confirm step before it fires.
 */
describe('StaffAccountsPage', () => {
  beforeEach(() => {
    fetchStaffDirectoryMock.mockReset()
    setStaffActiveMock.mockReset()
    setStaffRoleMock.mockReset()
    createStaffAccountMock.mockReset()
    fetchStaffDirectoryMock.mockResolvedValue([OWNER, STAFF, SUSPENDED])
  })

  it('renders the directory with role and status, and hides actions for the signed-in owner\'s own row', async () => {
    render(<StaffAccountsPage />)
    expect(await screen.findByText('Jane Owner')).toBeInTheDocument()
    expect(screen.getByText('Sam Staff')).toBeInTheDocument()
    expect(screen.getByText('Alex Away')).toBeInTheDocument()

    const ownerRow = screen.getByText('Jane Owner').closest('tr')
    expect(ownerRow).not.toBeNull()
    expect(ownerRow!.querySelector('button')).toBeNull()
  })

  it('requires a confirm step before suspending a staff account, then calls setStaffActive', async () => {
    render(<StaffAccountsPage />)
    await screen.findByText('Sam Staff')

    const staffRow = screen.getByText('Sam Staff').closest('tr')!
    fireEvent.click(within(staffRow).getByRole('button', { name: /suspend/i }))
    expect(setStaffActiveMock).not.toHaveBeenCalled()

    fireEvent.click(within(staffRow).getByRole('button', { name: /yes, confirm/i }))
    await waitFor(() => expect(setStaffActiveMock).toHaveBeenCalledWith('staff-1', false))
  })

  it('offers "Reactivate" and "Make owner" for a suspended staff account', async () => {
    render(<StaffAccountsPage />)
    await screen.findByText('Alex Away')

    const row = screen.getByText('Alex Away').closest('tr')!
    expect(within(row).getByRole('button', { name: /reactivate/i })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: /make owner/i })).toBeInTheDocument()
  })

  it('creates a staff account through the form and shows the one-time credentials banner', async () => {
    createStaffAccountMock.mockResolvedValue({
      id: 'new-1',
      fullName: 'Nadia New',
      email: 'nadia@example.com',
      role: 'staff',
    })
    render(<StaffAccountsPage />)
    await screen.findByText('Sam Staff')

    fireEvent.click(screen.getByRole('button', { name: /add staff member/i }))
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Nadia New' } })
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'nadia@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(createStaffAccountMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/staff account created/i)).toBeInTheDocument()
    expect(screen.getByText('nadia@example.com')).toBeInTheDocument()
  })

  it('shows field-level errors from the server without creating the account', async () => {
    createStaffAccountMock.mockRejectedValue(
      new AdminApiError('Please fix the highlighted fields.', { email: 'Enter a valid email address.' }),
    )
    render(<StaffAccountsPage />)
    await screen.findByText('Sam Staff')

    fireEvent.click(screen.getByRole('button', { name: /add staff member/i }))
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Nadia New' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument())
  })
})
