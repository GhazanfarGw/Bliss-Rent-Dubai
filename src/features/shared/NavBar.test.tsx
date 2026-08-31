import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import i18n from '@/i18n'
import { NavBar } from '@/features/shared/NavBar'
import { RouteNavigationShell } from '@/features/shared/RouteNavigationShell'

function renderNavBar() {
  return render(
    <MemoryRouter>
      <NavBar />
    </MemoryRouter>,
  )
}

describe('NavBar', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('shows the primary desktop links and the Search Cars CTA', () => {
    renderNavBar()

    expect(screen.getAllByRole('link', { name: 'Home' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'About' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Browse Fleet' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Car Types' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Services' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Contact' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Search Cars' }).length).toBeGreaterThan(0)
  })

  it('About/Car Types/Contact are real pages; Services is still an in-page anchor', () => {
    renderNavBar()
    const aboutLinks = screen.getAllByRole('link', { name: 'About' })
    const carTypeLinks = screen.getAllByRole('link', { name: 'Car Types' })
    const servicesLinks = screen.getAllByRole('link', { name: 'Services' })
    const contactLinks = screen.getAllByRole('link', { name: 'Contact' })
    expect(aboutLinks[0]).toHaveAttribute('href', '/about')
    expect(carTypeLinks[0]).toHaveAttribute('href', '/car-types')
    expect(contactLinks[0]).toHaveAttribute('href', '/contact')
    expect(servicesLinks[0]).toHaveAttribute('href', '/#how-it-works')
  })

  it('mobile menu is closed by default and opens/closes via the hamburger button', () => {
    renderNavBar()
    const toggle = screen.getByRole('button', { name: /toggle menu/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    // Now two sets of the same links exist (desktop nav is hidden by CSS,
    // but still in the DOM, plus the mobile drawer) — assert the drawer
    // itself renders a Home link.
    expect(screen.getAllByRole('link', { name: 'Home' }).length).toBeGreaterThanOrEqual(2)

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('hides while scrolling down and returns while scrolling up', () => {
    renderNavBar()
    const header = screen.getByRole('banner')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 240 })
    fireEvent.scroll(window)
    expect(header.className).toContain('-translate-y-full')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 })
    fireEvent.scroll(window)
    expect(header.className).toContain('translate-y-0')
  })

  it('switches the interface language, which also flips the document to RTL', async () => {
    renderNavBar()
    const switchButtons = screen.getAllByRole('button', { name: /switch language/i })

    await act(async () => {
      fireEvent.click(switchButtons[0])
    })

    expect(document.documentElement.dir).toBe('rtl')
    expect(screen.getAllByRole('link', { name: 'الرئيسية' }).length).toBeGreaterThan(0)
  })

  it('shows a route loader only after a real route change and scrolls to top', async () => {
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    function TestHarness() {
      const navigate = useNavigate()
      return (
        <>
          <button onClick={() => navigate('/search')}>Go to search</button>
          <Routes>
            <Route path="/" element={<div>Home</div>} />
            <Route path="/search" element={<div>Search</div>} />
          </Routes>
        </>
      )
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <RouteNavigationShell>
          <TestHarness />
        </RouteNavigationShell>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Go to search' }))
    })

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' })

    scrollSpy.mockRestore()
  })
})
