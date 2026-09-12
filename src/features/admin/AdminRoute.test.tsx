import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminRoute } from './AdminRoute'

const useAdminAuthMock = vi.fn()

vi.mock('@/features/admin/AdminAuthContext', () => ({
  useAdminAuth: () => useAdminAuthMock(),
}))

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <div>Secret dashboard content</div>
            </AdminRoute>
          }
        />
        <Route path="/admin/login" element={<div>Admin login page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminRoute — the only place that decides admin access', () => {
  it('shows a loading state instead of a flash of content while the session is still resolving', () => {
    useAdminAuthMock.mockReturnValue({ loading: true, session: null, adminProfile: null })
    renderGuarded()
    expect(screen.queryByText('Secret dashboard content')).not.toBeInTheDocument()
  })

  it('blocks an unauthenticated visitor — no session at all', () => {
    useAdminAuthMock.mockReturnValue({ loading: false, session: null, adminProfile: null })
    renderGuarded()
    expect(screen.getByText('Admin login page')).toBeInTheDocument()
    expect(screen.queryByText('Secret dashboard content')).not.toBeInTheDocument()
  })

  it('blocks a signed-in user who has no admin_profiles row (a real customer account, say)', () => {
    useAdminAuthMock.mockReturnValue({ loading: false, session: { user: { id: 'u1' } }, adminProfile: null })
    renderGuarded()
    expect(screen.getByText('Admin login page')).toBeInTheDocument()
    expect(screen.queryByText('Secret dashboard content')).not.toBeInTheDocument()
  })

  it('renders the protected content for a real admin', () => {
    useAdminAuthMock.mockReturnValue({
      loading: false,
      session: { user: { id: 'u1' } },
      adminProfile: { id: 'u1', full_name: 'Staff Member', role: 'staff', is_active: true },
      suspended: false,
    })
    renderGuarded()
    expect(screen.getByText('Secret dashboard content')).toBeInTheDocument()
  })

  it('blocks a suspended admin — see the Staff Accounts screen (is_active = false)', () => {
    useAdminAuthMock.mockReturnValue({
      loading: false,
      session: { user: { id: 'u1' } },
      adminProfile: { id: 'u1', full_name: 'Staff Member', role: 'staff', is_active: false },
      suspended: true,
    })
    renderGuarded()
    expect(screen.getByText('Admin login page')).toBeInTheDocument()
    expect(screen.queryByText('Secret dashboard content')).not.toBeInTheDocument()
  })
})
