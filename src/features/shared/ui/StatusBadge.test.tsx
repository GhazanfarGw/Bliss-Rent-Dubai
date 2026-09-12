import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'
import { AdminStatusBadge } from '@/features/admin/shared/AdminStatusBadge'

describe('StatusBadge', () => {
  it('translates a known status via the given namespace prefix', () => {
    render(<StatusBadge status="active" />)
    // en.ts's admin.status.active is "Active", not the raw enum value.
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('falls back to the raw status string for an unknown value', () => {
    render(<StatusBadge status="totally_unknown_status" />)
    expect(screen.getByText('totally_unknown_status')).toBeInTheDocument()
  })
})

describe('AdminStatusBadge (Phase 8 alias)', () => {
  it('renders identically to StatusBadge for the same status — same tone class, same text', () => {
    const { container: adminContainer } = render(<AdminStatusBadge status="pending_payment" />)
    const { container: sharedContainer } = render(<StatusBadge status="pending_payment" />)
    const adminSpan = adminContainer.querySelector('span')!
    const sharedSpan = sharedContainer.querySelector('span')!
    expect(adminSpan.className).toBe(sharedSpan.className)
    expect(adminSpan.textContent).toBe(sharedSpan.textContent)
  })
})
