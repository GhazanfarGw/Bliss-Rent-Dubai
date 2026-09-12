import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DocumentsRequiredSection } from '@/features/booking/DocumentsRequiredSection'

function renderIt() {
  return render(
    <MemoryRouter>
      <DocumentsRequiredSection />
    </MemoryRouter>,
  )
}

describe('DocumentsRequiredSection', () => {
  it('shows both the resident and visitor document groups with their real requirement items', () => {
    renderIt()

    expect(screen.getByText('For UAE Residents')).toBeInTheDocument()
    expect(screen.getByText('Valid UAE driving license')).toBeInTheDocument()
    expect(screen.getByText('Emirates ID (a residence visa copy may also be requested)')).toBeInTheDocument()

    expect(screen.getByText('For Visitors to the UAE')).toBeInTheDocument()
    expect(screen.getByText('Valid passport')).toBeInTheDocument()
    expect(screen.getByText('UAE entry visa or visit visa')).toBeInTheDocument()
    expect(screen.getByText(/International Driving Permit/)).toBeInTheDocument()
  })

  it('links to the real Contact page, not an invented external link', () => {
    renderIt()

    const link = screen.getByRole('link', { name: /contact us/i })
    expect(link).toHaveAttribute('href', '/contact')
  })
})
