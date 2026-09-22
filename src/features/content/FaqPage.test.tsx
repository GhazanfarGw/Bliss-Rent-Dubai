import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { FaqPage } from '@/features/content/FaqPage'

function renderIt() {
  return render(
    <MemoryRouter>
      <FaqPage />
    </MemoryRouter>,
  )
}

describe('FaqPage', () => {
  it('points to guides that answer the next question, and to the whole blog', () => {
    renderIt()

    const section = screen.getByRole('heading', { name: 'Guides for your UAE trip' }).closest('section') as HTMLElement
    expect(within(section).getByRole('link', { name: 'Documents Needed to Rent a Car in the UAE' })).toHaveAttribute('href', '/blog/documents-needed-to-rent-a-car-uae')
    expect(within(section).getByRole('link', { name: 'View all articles' })).toHaveAttribute('href', '/blog')
  })

  it('shows all real FAQ categories by default', () => {
    renderIt()
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1)
  })

  it('filters questions by the search box, over the existing real content only', async () => {
    renderIt()
    const search = screen.getByPlaceholderText(/search questions/i)
    const totalBefore = screen.getAllByRole('button', { hidden: true }).length

    await userEvent.type(search, 'zzzznonexistentzzzz')
    expect(screen.getByText('No matching questions')).toBeInTheDocument()
    expect(screen.queryAllByRole('button').length).toBeLessThan(totalBefore)
  })

  it('links to the Contact page for anyone who still has questions', () => {
    renderIt()
    const link = screen.getByRole('link', { name: /contact us/i })
    expect(link).toHaveAttribute('href', '/contact')
  })
})
