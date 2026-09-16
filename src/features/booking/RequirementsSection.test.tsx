import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RequirementsSection } from '@/features/booking/RequirementsSection'

function renderIt() {
  return render(
    <MemoryRouter>
      <RequirementsSection />
    </MemoryRouter>,
  )
}

describe('RequirementsSection', () => {
  it('shows the real numbered requirements list', () => {
    renderIt()

    expect(screen.getByText('Age')).toBeInTheDocument()
    expect(screen.getByText('Driving license')).toBeInTheDocument()
    expect(screen.getByText('Pickup & drop-off')).toBeInTheDocument()
  })

  // Redesign: the resident/visitor document checklists (previously their
  // own separate DocumentsRequiredSection) now render inside this same
  // section, as the floating dark card half of the 50/50 split.
  it('shows both the resident and visitor document groups with their real requirement items', () => {
    renderIt()

    expect(screen.getByText('For UAE Residents')).toBeInTheDocument()
    expect(screen.getByText('Valid UAE driving license')).toBeInTheDocument()
    expect(screen.getByText('Emirates ID (a residence visa copy may also be requested)')).toBeInTheDocument()

    expect(screen.getByText('For Visitors to the UAE')).toBeInTheDocument()
    expect(screen.getByText('Valid passport')).toBeInTheDocument()
    expect(screen.getByText('UAE entry visa or visit visa')).toBeInTheDocument()
    // The exact "International Driving Permit" phrase also appears in the
    // left column's own requirements copy — match the visitor group's
    // specific full item text instead of a loose substring.
    expect(screen.getByText(/International Driving Permit \(IDP\), if your home license/)).toBeInTheDocument()
  })

  it('links to the real Contact page, not an invented external link', () => {
    renderIt()

    const link = screen.getByRole('link', { name: /contact us/i })
    expect(link).toHaveAttribute('href', '/contact')
  })
})
