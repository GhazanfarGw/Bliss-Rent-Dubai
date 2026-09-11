import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotFoundPage } from '@/features/content/NotFoundPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <NotFoundPage />
    </MemoryRouter>,
  )
}

describe('NotFoundPage', () => {
  it('shows a real 404 message, not a blank page', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  })

  it('links back to real existing pages only', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /back to homepage/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /browse the fleet/i })).toHaveAttribute('href', '/search')
  })

  it('sets the document title', () => {
    renderPage()
    expect(document.title).toContain('Page not found')
  })
})
