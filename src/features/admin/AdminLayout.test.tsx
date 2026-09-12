import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'

let mockRole: 'super_admin' | 'staff' = 'super_admin'

vi.mock('@/features/admin/bookings/adminBookingsApi', () => ({
  fetchPendingBookingsCount: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/features/admin/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    adminProfile: { id: 'admin-1', full_name: 'Jane Admin', role: mockRole, created_at: '2026-01-01' },
    signOut: vi.fn(),
  }),
}))

/**
 * Covers the owner-only decision: the Audit Log nav item — and by
 * extension the route itself, guarded separately by SuperAdminRoute in
 * App.tsx — is hidden from staff accounts. Also covers the role badge
 * that gives each role a distinct identity in the sidebar.
 */
describe('AdminLayout — role-based nav visibility', () => {
  beforeEach(() => {
    mockRole = 'super_admin'
  })

  it('shows Audit Log, Staff Accounts, and an "Owner access" badge for a super_admin', () => {
    mockRole = 'super_admin'
    render(
      <MemoryRouter>
        <AdminLayout />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('link', { name: 'Audit Log' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Staff Accounts' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Owner access').length).toBeGreaterThan(0)
  })

  it('hides Audit Log and Staff Accounts, and shows a "Team member" badge for staff', () => {
    mockRole = 'staff'
    render(
      <MemoryRouter>
        <AdminLayout />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: 'Audit Log' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Staff Accounts' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Team member').length).toBeGreaterThan(0)
  })
})
