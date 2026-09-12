import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminSettingsPage } from './AdminSettingsPage'

const resetAllTestDataMock = vi.fn()

vi.mock('./adminSettingsApi', async () => {
  const actual = await vi.importActual<typeof import('./adminSettingsApi')>('./adminSettingsApi')
  return {
    ...actual,
    resetAllTestData: (...args: unknown[]) => resetAllTestDataMock(...args),
  }
})

let mockAdminRole: 'super_admin' | 'staff' = 'super_admin'

vi.mock('@/features/admin/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    adminProfile: { id: 'admin-1', full_name: 'Jane Admin', role: mockAdminRole, is_active: true, created_at: '2026-01-01' },
    session: { user: { email: 'jane@bliss.example' } },
    signOut: vi.fn(),
  }),
}))

afterEach(() => {
  mockAdminRole = 'super_admin'
})

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminSettingsPage />
    </MemoryRouter>,
  )
}

/**
 * Covers the "Danger Zone" reset feature added for the testing phase (see
 * supabase/migrations/20260830000000_admin_reset_test_data.sql). The point
 * of these tests is the confirm-gating — this button permanently deletes
 * production rows, so it must never fire without the exact "RESET" text.
 */
describe('AdminSettingsPage — Danger Zone', () => {
  beforeEach(() => {
    resetAllTestDataMock.mockReset()
  })

  it('keeps the confirm button disabled until exactly "RESET" is typed', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reset all test data/i }))

    const input = await screen.findByPlaceholderText('RESET')
    const confirmButton = screen.getByRole('button', { name: /yes, delete everything/i })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(input, { target: { value: 'reset please' } })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(input, { target: { value: 'RESET' } })
    expect(confirmButton).not.toBeDisabled()
    expect(resetAllTestDataMock).not.toHaveBeenCalled()
  })

  it('calls resetAllTestData and shows the row count once confirmed', async () => {
    resetAllTestDataMock.mockResolvedValue({
      payments: 2,
      complaints: 1,
      bookings: 3,
      drivers: 3,
      vehicles: 4,
      customers: 3,
      audit_logs: 10,
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reset all test data/i }))
    fireEvent.change(await screen.findByPlaceholderText('RESET'), { target: { value: 'RESET' } })
    fireEvent.click(screen.getByRole('button', { name: /yes, delete everything/i }))

    await waitFor(() => expect(resetAllTestDataMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText(/26 rows removed/i)).toBeInTheDocument())
  })

  it('shows the server error message (e.g. "not a super_admin") when the RPC rejects', async () => {
    resetAllTestDataMock.mockRejectedValue(new Error('Only a super_admin can reset test data'))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reset all test data/i }))
    fireEvent.change(await screen.findByPlaceholderText('RESET'), { target: { value: 'RESET' } })
    fireEvent.click(screen.getByRole('button', { name: /yes, delete everything/i }))

    await waitFor(() => expect(screen.getByText('Only a super_admin can reset test data')).toBeInTheDocument())
  })
})

describe('AdminSettingsPage — Staff Accounts link', () => {
  it('links a super_admin to the dedicated Staff Accounts screen', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /manage staff/i })
    expect(link).toHaveAttribute('href', '/admin/staff')
  })
})

/**
 * Extension pricing/penalty policy — including the late-extension penalty
 * percentage — is a super_admin-only business decision (RLS: "super admins
 * update extension ... settings" both require is_super_admin()). This is
 * the client-side half of that gate: a regular staff account should never
 * even SEE the controls, as defense in depth alongside the database-level
 * enforcement (which is the real, authoritative guard — see
 * extension_pricing_settings/extension_penalty_settings RLS policies in
 * supabase/migrations/20260902000000_phase7_rental_extensions.sql and
 * 20260903000000_phase7_booking_reassignment.sql).
 */
describe('AdminSettingsPage — extension pricing/penalty settings are super_admin only', () => {
  beforeEach(() => {
    mockAdminRole = 'super_admin'
  })

  it('shows the Extension pricing/penalty sections for a super_admin', () => {
    renderPage()
    expect(screen.getByText('Extension pricing policy')).toBeInTheDocument()
    expect(screen.getByText('Late-extension penalty policy')).toBeInTheDocument()
  })

  it('hides both sections entirely for a regular staff account — the real gate is still DB-level RLS (is_super_admin()), this is defense in depth', () => {
    mockAdminRole = 'staff'
    renderPage()
    expect(screen.queryByText('Extension pricing policy')).not.toBeInTheDocument()
    expect(screen.queryByText('Late-extension penalty policy')).not.toBeInTheDocument()
    // The Danger Zone and Staff Accounts link are also owner-only for the same reason.
    expect(screen.queryByText('Danger zone — testing only')).not.toBeInTheDocument()
  })
})
