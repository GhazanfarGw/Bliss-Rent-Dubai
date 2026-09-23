import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { FeaturedVehicles } from '@/features/booking/FeaturedVehicles'
import { fetchAllAvailableVehicles } from '@/features/booking/api'
import type { VehicleWithDetails } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchAllAvailableVehicles: vi.fn(),
}))

function vehicleIn(category: { id: string; name: string }, overrides: { id: string; make: string; model: string }): VehicleWithDetails {
  return {
    category_id: category.id,
    model_year: 2024,
    transmission: 'automatic',
    seats: 4,
    plate_number: `PLATE-${overrides.id}`,
    status: 'available',
    created_at: '2026-01-01T00:00:00Z',
    vehicle_categories: { id: category.id, name: category.name, description: null },
    vehicle_images: [{ id: `img-${overrides.id}`, vehicle_id: overrides.id, storage_path: `${overrides.id}/main.jpg`, is_primary: true, sort_order: 0 }],
    pricing: [{ id: `p-${overrides.id}`, vehicle_id: overrides.id, term: 'daily', list_price: 1000, client_price: 800, currency: 'AED' }],
    ...overrides,
  } as unknown as VehicleWithDetails
}

const ECONOMY = { id: 'cat-eco', name: 'Economy' }
const LUXURY = { id: 'cat-lux', name: 'Luxury' }
const SPORTS = { id: 'cat-sports', name: 'Sports & Supercars' }
const SUV = { id: 'cat-suv', name: 'SUV' }

const camry = vehicleIn(ECONOMY, { id: 'veh-eco-1', make: 'Toyota', model: 'Camry' })
const cullinan = vehicleIn(LUXURY, { id: 'veh-lux-1', make: 'Rolls-Royce', model: 'Cullinan' })
const huracan = vehicleIn(SPORTS, { id: 'veh-sports-1', make: 'Lamborghini', model: 'Huracan EVO' })
const defender = vehicleIn(SUV, { id: 'veh-suv-1', make: 'Land Rover', model: 'Defender 110' })
const threeLuxury = [
  cullinan,
  vehicleIn(LUXURY, { id: 'veh-lux-2', make: 'Bentley', model: 'Continental GT' }),
  vehicleIn(LUXURY, { id: 'veh-lux-3', make: 'Mercedes-Benz', model: 'S580' }),
]

function mockFleet(vehicles: VehicleWithDetails[]) {
  vi.mocked(fetchAllAvailableVehicles).mockResolvedValue(vehicles)
}

function renderIt() {
  return render(
    <MemoryRouter>
      <FeaturedVehicles />
    </MemoryRouter>,
  )
}

/** The category pills — the buttons carrying aria-pressed. */
function tabLabels(): (string | null)[] {
  return screen
    .getAllByRole('button')
    .filter((b) => b.hasAttribute('aria-pressed'))
    .map((b) => b.textContent)
}

describe('FeaturedVehicles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows an honest empty state when there are no vehicles — never fake data, and no tabs', async () => {
    mockFleet([])
    renderIt()

    expect(await screen.findByText('No vehicles listed yet')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /view details/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Vehicle categories' })).not.toBeInTheDocument()
  })

  it('builds one tab per live category, premium-first, with Economy last', async () => {
    mockFleet([camry, defender, huracan, cullinan])
    renderIt()

    await screen.findAllByText('Rolls-Royce Cullinan')
    expect(tabLabels()).toEqual(['Luxury', 'Sports & Supercars', 'SUV', 'Economy'])
  })

  it('only offers categories that have an available vehicle — no empty tab', async () => {
    mockFleet([camry, huracan])
    renderIt()

    await screen.findAllByText('Lamborghini Huracan EVO')
    expect(tabLabels()).toEqual(['Sports & Supercars', 'Economy'])
  })

  it('shows a category the site has never heard of under its stored name, sorted before Economy', async () => {
    mockFleet([camry, vehicleIn({ id: 'cat-conv', name: 'Convertible' }, { id: 'veh-conv-1', make: 'Mazda', model: 'MX-5' })])
    renderIt()

    await screen.findAllByText('Mazda MX-5')
    expect(tabLabels()).toEqual(['Convertible', 'Economy'])
  })

  it("shows only the active category's real vehicles, opening on the first tab and switching on click", async () => {
    const user = userEvent.setup()
    mockFleet([camry, defender, huracan, cullinan])
    renderIt()

    // Each real vehicle renders twice — the row is duplicated once so the
    // auto-scroll loop is seamless.
    expect(await screen.findAllByText('Rolls-Royce Cullinan')).toHaveLength(2)
    expect(screen.queryByText('Lamborghini Huracan EVO')).not.toBeInTheDocument()
    expect(screen.queryByText('Toyota Camry')).not.toBeInTheDocument()

    // One shared heading for the whole section; the tabs are buttons, not headings.
    expect(screen.getByRole('heading', { name: 'Featured vehicles' })).toBeInTheDocument()
    const sportsTab = screen.getByRole('button', { name: 'Sports & Supercars' })
    expect(sportsTab).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Luxury' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(sportsTab)

    expect(await screen.findAllByText('Lamborghini Huracan EVO')).toHaveLength(2)
    expect(screen.queryByText('Rolls-Royce Cullinan')).not.toBeInTheDocument()
    expect(sportsTab).toHaveAttribute('aria-pressed', 'true')
  })

  it('fetches the fleet once — switching tabs never refetches', async () => {
    const user = userEvent.setup()
    mockFleet([camry, huracan])
    renderIt()

    await screen.findAllByText('Lamborghini Huracan EVO')
    await user.click(screen.getByRole('button', { name: 'Economy' }))
    await screen.findAllByText('Toyota Camry')

    expect(fetchAllAvailableVehicles).toHaveBeenCalledTimes(1)
  })

  it('shows at most six vehicles per category', async () => {
    mockFleet(
      Array.from({ length: 9 }, (_, i) => vehicleIn(SPORTS, { id: `veh-s-${i}`, make: `Make${i}`, model: 'GT' })),
    )
    renderIt()

    await screen.findAllByText('Make0 GT')
    // 6 real cards, each rendered twice for the seamless loop.
    expect(document.querySelectorAll('.w-\\[82vw\\]')).toHaveLength(12)
  })

  it('auto-scrolls the active row and hides the duplicated (loop-only) copy from screen readers and keyboard tabbing', async () => {
    mockFleet([cullinan])
    renderIt()

    const cards = await screen.findAllByText('Rolls-Royce Cullinan')
    expect(cards).toHaveLength(2)

    expect(document.querySelector('.animate-featured-marquee-left')).not.toBeNull()

    const wrappers = cards.map((card) => card.closest('[aria-hidden], .w-\\[82vw\\]'))
    const hiddenCount = wrappers.filter((el) => el?.getAttribute('aria-hidden') === 'true').length
    expect(hiddenCount).toBe(1)
  })

  it('keeps the loop-only duplicate row clickable (never inert) but out of the tab order — a right-moving row starts scrolled onto it', async () => {
    mockFleet([cullinan, camry])
    const user = userEvent.setup()
    renderIt()
    await screen.findAllByText('Rolls-Royce Cullinan')
    await user.click(screen.getByRole('button', { name: 'Economy' }))
    const cards = await screen.findAllByText('Toyota Camry')

    const [original, duplicate] = cards.map((card) => card.closest('.w-\\[82vw\\]') as HTMLElement)
    expect(document.querySelector('[inert]')).toBeNull()

    const duplicateLinks = duplicate.querySelectorAll('a')
    expect(duplicateLinks.length).toBeGreaterThan(0)
    duplicateLinks.forEach((link) => expect(link).toHaveAttribute('tabindex', '-1'))

    original.querySelectorAll('a').forEach((link) => expect(link).not.toHaveAttribute('tabindex'))
  })

  it('scrolls neighbouring tabs in opposite directions', async () => {
    const user = userEvent.setup()
    mockFleet([cullinan, huracan])
    renderIt()

    await screen.findAllByText('Rolls-Royce Cullinan')
    expect(document.querySelector('.animate-featured-marquee-left')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Sports & Supercars' }))

    await screen.findAllByText('Lamborghini Huracan EVO')
    expect(document.querySelector('.animate-featured-marquee-right')).not.toBeNull()
    expect(document.querySelector('.animate-featured-marquee-left')).toBeNull()
  })

  it('offers a single website Book now link and a WhatsApp icon on each featured card, plus a link to the full fleet', async () => {
    mockFleet([cullinan])
    renderIt()

    await screen.findAllByText('Rolls-Royce Cullinan')
    // The loop-only duplicate is aria-hidden, so exactly one of each is exposed.
    expect(screen.getByRole('link', { name: /book now/i })).toHaveAttribute('href', '/vehicles/veh-lux-1')
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute('href', expect.stringContaining('https://wa.me/'))
    expect(screen.getByRole('link', { name: /view all vehicles/i })).toHaveAttribute('href', '/search')
  })

  it("shows the empty state (not a crash) if the fleet fetch fails", async () => {
    vi.mocked(fetchAllAvailableVehicles).mockRejectedValue(new Error('network down'))
    renderIt()

    expect(await screen.findByText('No vehicles listed yet')).toBeInTheDocument()
  })

  it('puts "View all vehicles" under the row, not in the heading', async () => {
    mockFleet([cullinan])
    renderIt()
    await screen.findAllByText('Rolls-Royce Cullinan')

    const viewAll = screen.getByRole('link', { name: /view all vehicles/i })
    const carousel = screen.getByRole('region', { name: 'Featured vehicles carousel' })
    // eslint-disable-next-line no-bitwise
    expect(carousel.compareDocumentPosition(viewAll) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Featured vehicles' }).closest('div')).not.toContainElement(viewAll)
  })

  describe('filling the window', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    /** A 1216px window onto 300px cards (jsdom does no layout of its own). */
    function layOutWindow() {
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1216)
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width: 300 } as DOMRect)
    }

    it('repeats a short category until each half of the loop is wider than the window — no blank stretch on the right', async () => {
      layOutWindow()
      mockFleet(threeLuxury) // a list of 3 is 900px: one copy per half would leave a gap in a 1216px window
      renderIt()
      await screen.findAllByText('Rolls-Royce Cullinan')

      // ceil(1216 / 900) = 2 copies per half, two halves: 12 cards, only the first 3 real.
      const wrappers = document.querySelectorAll<HTMLElement>('.w-\\[82vw\\]')
      expect(wrappers).toHaveLength(12)
      expect([...wrappers].filter((card) => card.getAttribute('aria-hidden') !== 'true')).toHaveLength(3)
      expect(screen.getAllByRole('link', { name: /book now/i })).toHaveLength(3)
    })

    it('does not repeat a category that already fills the window', async () => {
      layOutWindow()
      mockFleet(Array.from({ length: 6 }, (_, i) => vehicleIn(SPORTS, { id: `veh-s-${i}`, make: `Make${i}`, model: 'GT' })))
      renderIt()
      await screen.findAllByText('Make0 GT')

      // 6 cards are 1800px, wider than 1216px: just the two halves.
      expect(document.querySelectorAll('.w-\\[82vw\\]')).toHaveLength(12)
    })

    it('fills the window even for a single car', async () => {
      layOutWindow()
      mockFleet([cullinan])
      renderIt()
      await screen.findAllByText('Rolls-Royce Cullinan')

      // ceil(1216 / 300) = 5 copies per half.
      expect(document.querySelectorAll('.w-\\[82vw\\]')).toHaveLength(10)
      expect(screen.getAllByRole('link', { name: /book now/i })).toHaveLength(1)
    })
  })

  describe('previous / next arrows', () => {
    /** A stand-in for the CSS marquee animation the browser runs on the row. */
    function fakeMarquee(currentTime = 0) {
      return {
        currentTime,
        pause: vi.fn(),
        play: vi.fn(),
        effect: { getComputedTiming: () => ({ duration: 36000 }) },
      }
    }

    /**
     * jsdom does no layout: make the row 2400px wide (so its animated half is
     * 1200px) with 300px cards, i.e. one card is a quarter of the way round —
     * a quarter of the animation's 36 seconds, 9000ms.
     */
    function layOutRow() {
      vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(2400)
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width: 300 } as DOMRect)
    }

    function withMarquee(marquee: ReturnType<typeof fakeMarquee>) {
      Element.prototype.getAnimations = (() => [marquee]) as unknown as typeof Element.prototype.getAnimations
    }

    afterEach(() => {
      // @ts-expect-error — jsdom has no Element.getAnimations / scrollBy, so remove the stubs again
      delete Element.prototype.getAnimations
      // @ts-expect-error — as above
      delete Element.prototype.scrollBy
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    /** Presses an arrow and lets the slide play out on a fake clock. */
    function press(name: 'Previous vehicles' | 'Next vehicles') {
      vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
      fireEvent.click(screen.getByRole('button', { name }))
      vi.advanceTimersByTime(1500)
    }

    it('puts both arrows after the last category tab — and shows no counter', async () => {
      mockFleet(threeLuxury)
      renderIt()
      await screen.findAllByText('Rolls-Royce Cullinan')

      const previous = screen.getByRole('button', { name: 'Previous vehicles' })
      const next = screen.getByRole('button', { name: 'Next vehicles' })
      const luxuryTab = screen.getByRole('button', { name: 'Luxury' })
      expect(previous).toBeEnabled()
      expect(next).toBeEnabled()
      // eslint-disable-next-line no-bitwise
      expect(previous.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // eslint-disable-next-line no-bitwise
      expect(luxuryTab.compareDocumentPosition(previous) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(screen.queryByText(/^\d\d \/ \d\d$/)).not.toBeInTheDocument()
      // The arrows are not category tabs.
      expect(tabLabels()).toEqual(['Luxury'])
    })

    it('shows no arrows while loading, when the fleet is empty, or when it fails', async () => {
      mockFleet([])
      renderIt()
      await screen.findByText('No vehicles listed yet')

      expect(screen.queryByRole('button', { name: 'Next vehicles' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Previous vehicles' })).not.toBeInTheDocument()
    })

    it('"next" slides the running row on by exactly one card without ever pausing or restarting it, so the stylesheet keeps control of the hover pause', async () => {
      const marquee = fakeMarquee(0)
      layOutRow()
      withMarquee(marquee)
      mockFleet(threeLuxury)
      renderIt()
      await screen.findAllByText('Rolls-Royce Cullinan')

      press('Next vehicles')

      expect(marquee.currentTime).toBeCloseTo(9000, 3)
      expect(marquee.pause).not.toHaveBeenCalled()
      expect(marquee.play).not.toHaveBeenCalled()
    })

    it('"previous" slides it back by one card, wrapping the animation clock instead of going negative', async () => {
      const marquee = fakeMarquee(0)
      layOutRow()
      withMarquee(marquee)
      mockFleet(threeLuxury)
      renderIt()
      await screen.findAllByText('Rolls-Royce Cullinan')

      press('Previous vehicles')

      expect(marquee.currentTime).toBeCloseTo(36000 - 9000, 3)
    })

    it('presses made while a slide is still under way add up', async () => {
      const marquee = fakeMarquee(0)
      layOutRow()
      withMarquee(marquee)
      mockFleet(threeLuxury)
      renderIt()
      await screen.findAllByText('Rolls-Royce Cullinan')

      vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
      fireEvent.click(screen.getByRole('button', { name: 'Next vehicles' }))
      vi.advanceTimersByTime(150)
      fireEvent.click(screen.getByRole('button', { name: 'Next vehicles' }))
      vi.advanceTimersByTime(1500)

      expect(marquee.currentTime).toBeCloseTo(18000, 3)
      expect(marquee.pause).not.toHaveBeenCalled()
    })

    it('works the same way on every category — a row that drifts the other way is moved the other way round', async () => {
      const marquee = fakeMarquee(0)
      layOutRow()
      withMarquee(marquee)
      const user = userEvent.setup()
      mockFleet([cullinan, huracan])
      renderIt()
      await screen.findAllByText('Rolls-Royce Cullinan')
      await user.click(screen.getByRole('button', { name: 'Sports & Supercars' }))
      await screen.findAllByText('Lamborghini Huracan EVO')

      // Neighbouring tabs run the animation in opposite directions, so "next"
      // winds this row's clock back rather than forward.
      press('Next vehicles')
      expect(marquee.currentTime).toBeCloseTo(36000 - 9000, 3)
    })

    it('slides the still row by hand for visitors who prefer reduced motion (no animation runs)', async () => {
      const scrollBy = vi.fn()
      Element.prototype.scrollBy = scrollBy as unknown as typeof Element.prototype.scrollBy
      layOutRow()
      mockFleet(threeLuxury)
      renderIt()
      await screen.findAllByText('Rolls-Royce Cullinan')

      fireEvent.click(screen.getByRole('button', { name: 'Next vehicles' }))
      expect(scrollBy).toHaveBeenLastCalledWith({ left: 300, behavior: 'smooth' })

      fireEvent.click(screen.getByRole('button', { name: 'Previous vehicles' }))
      expect(scrollBy).toHaveBeenLastCalledWith({ left: -300, behavior: 'smooth' })
    })
  })

  describe('drag / swipe', () => {
    /** A stand-in for the CSS marquee animation the browser runs on the row. */
    function fakeMarquee(currentTime = 0) {
      return {
        currentTime,
        pause: vi.fn(),
        play: vi.fn(),
        effect: { getComputedTiming: () => ({ duration: 36000 }) },
      }
    }

    /** Same 2400px row / 300px card layout the arrow tests use — see layOutRow above. */
    function layOutRow() {
      vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(2400)
    }

    function withMarquee(marquee: ReturnType<typeof fakeMarquee>) {
      Element.prototype.getAnimations = (() => [marquee]) as unknown as typeof Element.prototype.getAnimations
    }

    function track(): HTMLElement {
      return document.querySelector('.animate-featured-marquee-left, .animate-featured-marquee-right') as HTMLElement
    }

    afterEach(() => {
      // @ts-expect-error — jsdom has no Element.getAnimations by default; see the arrow tests above.
      delete Element.prototype.getAnimations
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('a real drag moves the marquee clock and pauses the row, without ever calling Animation.pause/play', async () => {
      const marquee = fakeMarquee(0)
      layOutRow()
      withMarquee(marquee)
      mockFleet([cullinan])
      renderIt()
      await screen.findAllByText('Rolls-Royce Cullinan')

      const row = track()
      fireEvent.pointerDown(row, { pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(row, { pointerId: 1, clientX: 80 })

      expect(row.style.animationPlayState).toBe('paused')

      fireEvent.pointerUp(row, { pointerId: 1, clientX: 80 })

      expect(marquee.currentTime).toBeCloseTo(600, 3)
      expect(marquee.pause).not.toHaveBeenCalled()
      expect(marquee.play).not.toHaveBeenCalled()
    })

    /**
     * react-router's Link calls preventDefault() on every click, drag or not
     * (that's how it swaps in client-side navigation for the real one), so
     * `defaultPrevented` can't tell our suppression apart from Link's own
     * normal behaviour. Mounting a real destination route and checking
     * whether it actually rendered is the only way to prove navigation was
     * (or wasn't) swallowed.
     */
    function renderWithRoutes() {
      return render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<FeaturedVehicles />} />
            <Route path="/vehicles/:id" element={<div>Vehicle detail page</div>} />
          </Routes>
        </MemoryRouter>,
      )
    }

    it('swallows the click a drag leaves behind, so Book now does not navigate after dragging across a card', async () => {
      const marquee = fakeMarquee(0)
      layOutRow()
      withMarquee(marquee)
      mockFleet([cullinan])
      renderWithRoutes()
      await screen.findAllByText('Rolls-Royce Cullinan')

      const row = track()
      fireEvent.pointerDown(row, { pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(row, { pointerId: 1, clientX: 80 })
      fireEvent.pointerUp(row, { pointerId: 1, clientX: 80 })
      fireEvent.click(screen.getByRole('link', { name: /book now/i }))

      expect(screen.queryByText('Vehicle detail page')).not.toBeInTheDocument()
      expect(screen.getAllByText('Rolls-Royce Cullinan').length).toBeGreaterThan(0)
    })

    it('the WhatsApp button is likewise protected from a drag that ends over it', async () => {
      const marquee = fakeMarquee(0)
      layOutRow()
      withMarquee(marquee)
      mockFleet([cullinan])
      renderIt()
      await screen.findAllByText('Rolls-Royce Cullinan')

      const row = track()
      fireEvent.pointerDown(row, { pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(row, { pointerId: 1, clientX: 80 })
      fireEvent.pointerUp(row, { pointerId: 1, clientX: 80 })

      const whatsapp = screen.getByRole('link', { name: /whatsapp/i })
      const clickEvent = createEvent.click(whatsapp)
      fireEvent(whatsapp, clickEvent)

      expect(clickEvent.defaultPrevented).toBe(true)
    })

    it('a movement below the drag threshold is still a plain tap — Book now navigates normally and the clock does not move', async () => {
      const marquee = fakeMarquee(0)
      layOutRow()
      withMarquee(marquee)
      mockFleet([cullinan])
      renderWithRoutes()
      await screen.findAllByText('Rolls-Royce Cullinan')

      const row = track()
      fireEvent.pointerDown(row, { pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(row, { pointerId: 1, clientX: 103 })
      fireEvent.pointerUp(row, { pointerId: 1, clientX: 103 })

      expect(marquee.currentTime).toBe(0)

      fireEvent.click(screen.getByRole('link', { name: /book now/i }))

      expect(await screen.findByText('Vehicle detail page')).toBeInTheDocument()
    })

    it('resumes auto-play a short beat after the drag ends, not the instant it does', async () => {
      const marquee = fakeMarquee(0)
      layOutRow()
      withMarquee(marquee)
      mockFleet([cullinan])
      renderIt()
      await screen.findAllByText('Rolls-Royce Cullinan')

      vi.useFakeTimers()
      const row = track()
      fireEvent.pointerDown(row, { pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(row, { pointerId: 1, clientX: 80 })
      fireEvent.pointerUp(row, { pointerId: 1, clientX: 80 })

      expect(row.style.animationPlayState).toBe('paused')
      vi.advanceTimersByTime(300)
      expect(row.style.animationPlayState).toBe('paused')
      vi.advanceTimersByTime(400)
      expect(row.style.animationPlayState).toBe('')
    })

    it('drags the same physical direction under RTL — a raw pixel delta is never mirrored by text direction', async () => {
      const marquee = fakeMarquee(0)
      layOutRow()
      withMarquee(marquee)
      mockFleet([cullinan])
      render(
        <MemoryRouter>
          <div dir="rtl">
            <FeaturedVehicles />
          </div>
        </MemoryRouter>,
      )
      await screen.findAllByText('Rolls-Royce Cullinan')

      const row = track()
      fireEvent.pointerDown(row, { pointerId: 1, clientX: 100 })
      fireEvent.pointerMove(row, { pointerId: 1, clientX: 80 })
      fireEvent.pointerUp(row, { pointerId: 1, clientX: 80 })

      expect(marquee.currentTime).toBeCloseTo(600, 3)
    })
  })
})
