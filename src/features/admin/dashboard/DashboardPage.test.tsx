import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from './DashboardPage'

const { KPIS, ACTIVITY } = vi.hoisted(() => ({
  KPIS: {
    newBookings: 1,
    confirmedBookings: 2,
    activeRentals: 0,
    vehiclesAvailable: 5,
    vehiclesReserved: 1,
    vehiclesRented: 0,
    vehiclesMaintenance: 0,
    returnsDue: 0,
    pendingPayments: 0,
    openComplaints: 0,
  },
  ACTIVITY: { recentBookings: [], recentPayments: [], recentComplaints: [] },
}))

let mockRole: 'super_admin' | 'staff' = 'super_admin'

vi.mock('@/features/admin/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/adminApi')>('@/features/admin/adminApi')
  return {
    ...actual,
    fetchDashboardKpis: vi.fn().mockResolvedValue(KPIS),
    fetchRecentActivity: vi.fn().mockResolvedValue(ACTIVITY),
  }
})

vi.mock('@/features/admin/dashboard/adminRevenueApi', () => ({
  fetchRevenuePayments: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/features/admin/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    adminProfile: { id: 'admin-1', full_name: 'Jane Admin', role: mockRole, created_at: '2026-01-01' },
  }),
}))

/**
 * Covers the owner-only decision: Revenue & Earnings is a super_admin-only
 * widget on the dashboard, gated purely in the UI (the underlying
 * payments/bookings tables stay readable by staff for their own Payments
 * and Bookings screens — see the migration comment in
 * 20260831000000_staff_role_restrictions.sql for why that boundary is
 * deliberate rather than an oversight).
 */
describe('DashboardPage — role-based Revenue visibility', () => {
  beforeEach(() => {
    mockRole = 'super_admin'
  })

  it('shows Revenue & Earnings and an owner-framed greeting for a super_admin', async () => {
    mockRole = 'super_admin'
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/Revenue & Earnings/i)).toBeInTheDocument()
    expect(screen.getByText(/Welcome back, Jane Admin/i)).toBeInTheDocument()
  })

  it('hides Revenue & Earnings and shows a staff-framed greeting for staff', async () => {
    mockRole = 'staff'
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/Welcome, Jane Admin/i)).toBeInTheDocument()
    expect(screen.queryByText(/Revenue & Earnings/i)).not.toBeInTheDocument()
  })
})
