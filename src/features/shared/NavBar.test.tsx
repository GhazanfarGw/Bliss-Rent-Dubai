import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
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

  it('keeps the primary desktop navigation inside the viewport without forced horizontal overflow', () => {
    renderNavBar()

    const primaryNav = screen.getByRole('navigation', { name: /primary navigation/i })
    const innerNav = primaryNav.firstElementChild as HTMLElement
    expect(primaryNav).not.toHaveClass('overflow-x-auto')
    expect(primaryNav).not.toHaveClass('whitespace-nowrap')
    expect(innerNav).toHaveClass('flex')
    expect(innerNav).toHaveClass('max-w-full')
    expect(innerNav).toHaveClass('items-center')

    expect(screen.getAllByRole('link', { name: 'Home' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'About' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Fleet' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Booking Status' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Manage Booking' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Contact' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Book Now' }).length).toBeGreaterThan(0)
    // Vehicle Collection and Services were deliberately moved out of the
    // header (to the footer's Company column) to declutter it — they
    // should never reappear here.
    expect(screen.queryByRole('link', { name: 'Vehicle Collection' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Services' })).not.toBeInTheDocument()
  })

  it('About/Find My Car/Manage Booking/Contact are real, separate pages', () => {
    renderNavBar()
    const aboutLinks = screen.getAllByRole('link', { name: 'About' })
    const findMyCarLinks = screen.getAllByRole('link', { name: 'Booking Status' })
    const manageBookingLinks = screen.getAllByRole('link', { name: 'Manage Booking' })
    const contactLinks = screen.getAllByRole('link', { name: 'Contact' })
    expect(aboutLinks[0]).toHaveAttribute('href', '/about')
    expect(findMyCarLinks[0]).toHaveAttribute('href', '/find-my-car')
    expect(manageBookingLinks[0]).toHaveAttribute('href', '/manage-booking')
    expect(contactLinks[0]).toHaveAttribute('href', '/contact')
    // Find My Car and Manage Booking must be two distinct destinations,
    // never the same page under two labels.
    expect(findMyCarLinks[0]).not.toHaveAttribute('href', manageBookingLinks[0].getAttribute('href'))
  })

  it('mobile menu is closed by default and opens/closes via the hamburger button', () => {
    renderNavBar()
    const toggle = screen.getByRole('button', { name: /toggle menu/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const drawer = screen.getAllByRole('navigation').at(-1) as HTMLElement
    expect(within(drawer).getByRole('link', { name: /Home.*Back to homepage/i })).toHaveAttribute('href', '/')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays visible while scrolling and switches to the solid state', () => {
    renderNavBar()
    const header = screen.getByRole('banner')

    // Header height stays constant (--header-h) in both transparent and
    // solid states now, so TickerBar/StickySearchBar's fixed offsets never
    // fall out of sync with the header's actual rendered height.
    expect(header.className).toContain('h-[var(--header-h)]')
    expect(screen.getAllByRole('img', { name: 'Bliss Rent Dubai' })[1]).toHaveClass('h-11')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 240 })
    fireEvent.scroll(window)
    expect(header.className).not.toContain('-translate-y-full')
    expect(header.className).toContain('bg-white')
    expect(header.className).toContain('h-[var(--header-h)]')
    expect(screen.getAllByRole('img', { name: 'Bliss Rent Dubai' })[1]).toHaveClass('h-9')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 })
    fireEvent.scroll(window)
    expect(header.className).not.toContain('-translate-y-full')
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
