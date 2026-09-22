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
    expect(screen.getAllByRole('link', { name: 'Manage Booking' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Contact' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Book Now' }).length).toBeGreaterThan(0)
    // Vehicle Collection and Services were deliberately moved out of the
    // header (to the footer's Company column) to declutter it — they
    // should never reappear here.
    expect(screen.queryByRole('link', { name: 'Vehicle Collection' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Services' })).not.toBeInTheDocument()
  })

  it('has a Blog link in the desktop navigation, and in the mobile menu once it is opened', () => {
    renderNavBar()

    const desktopBlog = within(screen.getByRole('navigation', { name: /primary navigation/i })).getByRole('link', { name: 'Blog' })
    expect(desktopBlog).toHaveAttribute('href', '/blog')

    fireEvent.click(screen.getByRole('button', { name: /toggle menu/i }))
    const drawer = screen.getAllByRole('navigation').find((nav) => nav.className.includes('h-dvh')) as HTMLElement
    expect(within(drawer).getByRole('link', { name: /Blog.*Guides and travel tips/i })).toHaveAttribute('href', '/blog')
  })

  it('About/Manage Booking/Contact are real, separate pages — no leftover Booking Status link', () => {
    renderNavBar()
    const aboutLinks = screen.getAllByRole('link', { name: 'About' })
    const manageBookingLinks = screen.getAllByRole('link', { name: 'Manage Booking' })
    const contactLinks = screen.getAllByRole('link', { name: 'Contact' })
    expect(aboutLinks[0]).toHaveAttribute('href', '/about')
    expect(manageBookingLinks[0]).toHaveAttribute('href', '/manage-booking')
    expect(contactLinks[0]).toHaveAttribute('href', '/contact')
    // Booking Status was merged into Manage Booking — one nav item now.
    expect(screen.queryByRole('link', { name: 'Booking Status' })).not.toBeInTheDocument()
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

  it('REGRESSION: the open mobile drawer overlay never carries both pointer-events-none and pointer-events-auto at once', () => {
    // Real bug: the overlay's base classes always included
    // `pointer-events-none`, with `pointer-events-auto` appended only
    // while open — but Tailwind's generated stylesheet orders
    // `.pointer-events-none` after `.pointer-events-auto`, so `none` won
    // the cascade even while open, silently swallowing every tap on a
    // mobile menu link. jsdom doesn't compute Tailwind's real cascade, so
    // this asserts the class list directly: only one of the two classes
    // may be present at a time.
    renderNavBar()
    const toggle = screen.getByRole('button', { name: /toggle menu/i })

    fireEvent.click(toggle)
    const drawer = screen.getAllByRole('navigation').at(-1) as HTMLElement
    const overlay = drawer.closest('.fixed.inset-0.z-50') as HTMLElement
    expect(overlay).not.toBeNull()
    expect(overlay.className).toContain('pointer-events-auto')
    expect(overlay.className).not.toContain('pointer-events-none')
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

  describe('transparent header on every page, until scrolled', () => {
    function setScroll(y: number) {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: y })
    }
    function renderAt(path: string) {
      setScroll(0)
      return render(
        <MemoryRouter initialEntries={[path]}>
          <NavBar />
        </MemoryRouter>,
      )
    }

    it.each(['/', '/about', '/contact', '/search', '/blog', '/locations'])('is transparent on %s before scrolling', (path) => {
      renderAt(path)
      const header = screen.getByRole('banner')
      expect(header.className).toContain('bg-transparent')
      expect(header.className).toContain('border-transparent')
      expect(header.className).not.toContain('bg-white')
      expect(header.className).not.toContain('shadow-')
    })

    it.each(['/', '/about', '/book'])('uses white logo, links and controls on %s, whose dark hero sits under the header', (path) => {
      renderAt(path)
      expect(screen.getByRole('banner').className).toContain('text-white')
      const desktopLogo = screen.getAllByRole('img', { name: 'Bliss Rent Dubai' })[0]
      expect(desktopLogo.className).toContain('invert')
    })

    it.each(['/contact', '/search', '/blog', '/locations', '/faqs', '/car-types', '/manage-booking'])(
      'keeps the normal dark logo, links and controls on %s — a light page, where white text would disappear',
      (path) => {
        renderAt(path)
        const header = screen.getByRole('banner')
        expect(header.className).toContain('text-brand-navy')
        expect(header.className).not.toContain('text-white')
        for (const logo of screen.getAllByRole('img', { name: 'Bliss Rent Dubai' })) {
          expect(logo.className).not.toContain('invert')
        }
      },
    )

    it.each(['/', '/about', '/contact', '/blog'])('turns solid white once %s is scrolled, and back to transparent at the top', (path) => {
      renderAt(path)
      const header = screen.getByRole('banner')

      setScroll(240)
      fireEvent.scroll(window)
      expect(header.className).toContain('bg-white')
      expect(header.className).toContain('text-brand-navy')
      expect(header.className).not.toContain('bg-transparent')

      setScroll(0)
      fireEvent.scroll(window)
      expect(header.className).toContain('bg-transparent')
    })
  })

  describe('mobile menu as a side drawer', () => {
    // The hamburger is the first "toggle menu" button in the page; once open, the
    // drawer's own close button carries the same name. Named differently in Arabic.
    const TOGGLE = /toggle menu|فتح\/إغلاق القائمة/i
    const hamburger = () => screen.getAllByRole('button', { name: TOGGLE })[0]

    function openMenu() {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
      renderNavBar()
      fireEvent.click(hamburger())
      const panel = screen.getAllByRole('navigation').find((nav) => nav.className.includes('h-dvh')) as HTMLElement
      return { panel, overlay: panel.closest('.fixed.inset-0.z-50') as HTMLElement }
    }

    it('is a partial-width panel docked to the inline-end edge — not a full-screen sheet', () => {
      const { panel } = openMenu()
      expect(panel.className).toContain('w-[82%]')
      expect(panel.className).toContain('max-w-xs')
      expect(panel.className).toContain('end-0')
      expect(panel.className).not.toMatch(/(^|s)w-full(s|$)/)
    })

    it('sits over a dimmed, blurred backdrop rather than a solid white one, and tapping it closes the menu', () => {
      const { overlay } = openMenu()
      const backdrop = overlay.firstElementChild as HTMLElement
      expect(backdrop.className).toContain('bg-[#05070d]/60')
      expect(backdrop.className).toContain('backdrop-blur-sm')
      expect(backdrop.className).not.toContain('bg-white')

      fireEvent.click(backdrop)
      expect(hamburger()).toHaveAttribute('aria-expanded', 'false')
    })

    it('closes on Escape', () => {
      openMenu()
      expect(hamburger()).toHaveAttribute('aria-expanded', 'true')
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(hamburger()).toHaveAttribute('aria-expanded', 'false')
    })

    it('is rendered outside the header, so the floating chat and feedback widgets can never sit on top of it', () => {
      const { overlay } = openMenu()
      expect(screen.getByRole('banner').contains(overlay)).toBe(false)
      expect(overlay.parentElement).toBe(document.body)
    })

    it('titles the panel in the current language', async () => {
      await act(async () => {
        await i18n.changeLanguage('ar')
      })
      const { panel } = openMenu()
      expect(within(panel).getByText('القائمة')).toBeInTheDocument()
    })
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
