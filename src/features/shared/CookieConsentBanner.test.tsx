import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CookieConsentBanner } from '@/features/shared/CookieConsentBanner'

const STORAGE_KEY = 'dxb-cookie-consent'

function renderBanner() {
  return render(
    <MemoryRouter>
      <CookieConsentBanner />
    </MemoryRouter>,
  )
}

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('shows on a first visit, with no consent stored yet', async () => {
    renderBanner()
    expect(await screen.findByRole('region', { name: /cookie/i })).toBeInTheDocument()
    expect(screen.getByText(/essential cookies/i)).toBeInTheDocument()
  })

  it('does not show once a consent choice is already stored', () => {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    renderBanner()
    expect(screen.queryByRole('region', { name: /cookie/i })).not.toBeInTheDocument()
  })

  it('hides and stores "accepted" after clicking Accept', async () => {
    const user = userEvent.setup()
    renderBanner()
    await screen.findByRole('region', { name: /cookie/i })

    await user.click(screen.getByRole('button', { name: /accept/i }))

    await waitFor(() => expect(screen.queryByRole('region', { name: /cookie/i })).not.toBeInTheDocument())
    expect(localStorage.getItem(STORAGE_KEY)).toBe('accepted')
  })

  it('hides and stores "declined" after clicking Decline', async () => {
    const user = userEvent.setup()
    renderBanner()
    await screen.findByRole('region', { name: /cookie/i })

    await user.click(screen.getByRole('button', { name: /decline/i }))

    await waitFor(() => expect(screen.queryByRole('region', { name: /cookie/i })).not.toBeInTheDocument())
    expect(localStorage.getItem(STORAGE_KEY)).toBe('declined')
  })

  it('links to the real Cookie Policy page', async () => {
    renderBanner()
    const link = await screen.findByRole('link', { name: /cookie policy/i })
    expect(link).toHaveAttribute('href', '/cookie-policy')
  })
})
