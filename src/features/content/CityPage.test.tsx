import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import i18n from '@/i18n'
import { CityPage } from '@/features/content/CityPage'
import { CITY_GUIDES } from '@/features/content/cityGuides'
import { fetchLocations } from '@/features/booking/api'
import type { Location } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchLocations: vi.fn(),
}))

function location(overrides: Partial<Location> & { id: string; city: string; type: Location['type'] }): Location {
  return {
    name: 'Test Location',
    country: 'United Arab Emirates',
    airport_code: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Location
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/locations/:slug" element={<CityPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CityPage', () => {
  beforeEach(() => {
    vi.mocked(fetchLocations).mockReset()
    vi.mocked(fetchLocations).mockResolvedValue([])
  })

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
    document.querySelectorAll('script[data-page-jsonld]').forEach((el) => el.remove())
  })

  it("renders the city's headline, tagline, intro, highlights and driving tips", async () => {
    renderAt('/locations/sharjah')

    expect(await screen.findByRole('heading', { level: 1, name: 'Car rental in Sharjah' })).toBeInTheDocument()
    const guide = CITY_GUIDES.find((g) => g.slug === 'sharjah')!
    expect(screen.getByText(guide.en.tagline)).toBeInTheDocument()
    for (const paragraph of guide.en.intro) expect(screen.getByText(paragraph)).toBeInTheDocument()
    for (const highlight of guide.en.highlights) expect(screen.getByRole('heading', { name: highlight.title })).toBeInTheDocument()
    for (const tip of guide.en.drivingTips) expect(screen.getByText(tip)).toBeInTheDocument()
    await waitFor(() => expect(fetchLocations).toHaveBeenCalled())
  })

  it("shows the city's photo with its author/license credit, linked to the source", async () => {
    renderAt('/locations/dubai')

    const credit = await screen.findByRole('link', { name: /Photo: imran shahabuddin · CC BY 2\.0/ })
    expect(credit).toHaveAttribute('href', expect.stringContaining('commons.wikimedia.org'))
    expect(screen.getByRole('img', { name: 'Dubai' })).toBeInTheDocument()
  })

  it("lists only this city's real pickup points, grouped by type, with airport codes", async () => {
    vi.mocked(fetchLocations).mockResolvedValue([
      location({ id: 'd1', city: 'Dubai', type: 'airport', name: 'Dubai International Airport', airport_code: 'DXB' }),
      location({ id: 'd2', city: 'Dubai', type: 'city', name: 'Dubai Downtown' }),
      location({ id: 'a1', city: 'Abu Dhabi', type: 'airport', name: 'Abu Dhabi International Airport', airport_code: 'AUH' }),
    ])
    renderAt('/locations/dubai')

    expect(await screen.findByText('Dubai International Airport')).toBeInTheDocument()
    expect(screen.getByText('DXB')).toBeInTheDocument()
    expect(screen.getByText('Dubai Downtown')).toBeInTheDocument()
    expect(screen.getByText('Airport pickup')).toBeInTheDocument()
    expect(screen.getByText('City drop-off points')).toBeInTheDocument()
    expect(screen.queryByText('Abu Dhabi International Airport')).not.toBeInTheDocument()
  })

  it('says plainly when a city has no live pickup points yet, rather than inventing any', async () => {
    vi.mocked(fetchLocations).mockResolvedValue([location({ id: 'd1', city: 'Dubai', type: 'airport', name: 'DXB' })])
    renderAt('/locations/fujairah')

    expect(await screen.findByText("We're not live in Fujairah yet")).toBeInTheDocument()
    expect(screen.queryByText('DXB')).not.toBeInTheDocument()
  })

  it('shows an error note (not a crash) when the pickup points cannot be loaded', async () => {
    vi.mocked(fetchLocations).mockRejectedValue(new Error('boom'))
    renderAt('/locations/dubai')

    expect(await screen.findByText(/couldn't load the pickup points/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Car rental in Dubai' })).toBeInTheDocument()
  })

  it('links to every other city page, and never to itself', async () => {
    renderAt('/locations/ajman')
    await screen.findByRole('heading', { level: 1 })

    const other = screen.getByRole('heading', { name: 'Explore other cities' }).closest('section') as HTMLElement
    const hrefs = within(other)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
      .sort()
    expect(hrefs).toEqual(
      CITY_GUIDES.filter((g) => g.slug !== 'ajman')
        .map((g) => `/locations/${g.slug}`)
        .sort(),
    )
  })

  it('renders the not-found page for an unknown city slug', async () => {
    renderAt('/locations/atlantis')

    expect(await screen.findByText('Page not found')).toBeInTheDocument()
    expect(fetchLocations).not.toHaveBeenCalled()
  })

  it('uses the Arabic copy when the site language is Arabic', async () => {
    await act(async () => {
      await i18n.changeLanguage('ar')
    })
    renderAt('/locations/abu-dhabi')

    expect(await screen.findByRole('heading', { level: 1, name: 'تأجير سيارات في أبوظبي' })).toBeInTheDocument()
    const guide = CITY_GUIDES.find((g) => g.slug === 'abu-dhabi')!
    expect(screen.getByText(guide.ar.tagline)).toBeInTheDocument()
  })

  it('sets the tab title and the search-snippet description from the city copy', async () => {
    // The canonical tag is derived from the real window location (not the
    // MemoryRouter's), so point that at the page too.
    window.history.pushState({}, '', '/locations/al-ain')
    renderAt('/locations/al-ain')
    await screen.findByRole('heading', { level: 1 })

    expect(document.title).toBe('Car rental in Al Ain — Bliss Rent')
    const guide = CITY_GUIDES.find((g) => g.slug === 'al-ain')!
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(guide.en.metaDescription)
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(/\/locations\/al-ain$/)
    window.history.pushState({}, '', '/')
  })

  it('adds schema.org breadcrumb + city structured data, and removes it on leaving the page', async () => {
    const { unmount } = renderAt('/locations/dubai')
    await screen.findByRole('heading', { level: 1 })

    const script = document.querySelector('script[data-page-jsonld]')
    expect(script).not.toBeNull()
    const data = JSON.parse(script!.textContent ?? '{}')
    const types = data['@graph'].map((node: { '@type': string }) => node['@type'])
    expect(types).toEqual(['BreadcrumbList', 'City'])
    expect(data['@graph'][1].name).toBe('Dubai')

    unmount()
    expect(document.querySelector('script[data-page-jsonld]')).toBeNull()
  })

  it("lists this city's blog articles, linking to each", async () => {
    renderAt('/locations/ras-al-khaimah')

    const section = (await screen.findByRole('heading', { name: 'From our blog: Ras Al Khaimah' })).closest('section') as HTMLElement
    expect(within(section).getByRole('link', { name: 'Ras Al Khaimah & Jebel Jais by Car' })).toHaveAttribute('href', '/blog/ras-al-khaimah-jebel-jais-road-trip')
    expect(within(section).getByRole('link', { name: 'View all articles' })).toHaveAttribute('href', '/blog')
  })

  it('also lists an article that covers this city among others (Ajman → the Sharjah & Ajman guide)', async () => {
    renderAt('/locations/ajman')

    const section = (await screen.findByRole('heading', { name: 'From our blog: Ajman' })).closest('section') as HTMLElement
    expect(within(section).getByRole('link', { name: 'Sharjah & Ajman by Car: A Day Trip Guide' })).toHaveAttribute('href', '/blog/sharjah-and-ajman-by-car')
  })

  it('links every city page to the pages a customer checks before booking', async () => {
    renderAt('/locations/fujairah')

    const nav = (await screen.findByRole('navigation', { name: 'Before you book' })) as HTMLElement
    expect(within(nav).getByRole('link', { name: 'Car Types' })).toHaveAttribute('href', '/car-types')
    expect(within(nav).getByRole('link', { name: 'FAQs' })).toHaveAttribute('href', '/faqs')
    expect(within(nav).getByRole('link', { name: 'Booking Terms & Conditions' })).toHaveAttribute('href', '/booking-terms')
    expect(within(nav).getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog')
  })
})
