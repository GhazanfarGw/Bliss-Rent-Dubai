import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import i18n from '@/i18n'
import { BlogPostPage } from '@/features/blog/BlogPostPage'
import { findPostBySlug, relatedPosts } from '@/features/blog/blogPosts'
import { stripInline } from '@/features/blog/richText'
import { CITY_GUIDES } from '@/features/content/cityGuides'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/blog/:slug" element={<BlogPostPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const POST = findPostBySlug('dubai-to-hatta-road-trip')!

describe('BlogPostPage', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
    document.querySelectorAll('script[data-page-jsonld]').forEach((el) => el.remove())
  })

  it('renders the headline, the opening answer, every section and every FAQ', () => {
    renderAt(`/blog/${POST.slug}`)

    expect(screen.getByRole('heading', { level: 1, name: POST.en.title })).toBeInTheDocument()
    expect(screen.getByText(stripInline(POST.en.intro))).toBeInTheDocument()
    for (const section of POST.en.sections) expect(screen.getByRole('heading', { level: 2, name: section.heading })).toBeInTheDocument()
    for (const faq of POST.en.faqs ?? []) expect(screen.getByRole('heading', { level: 3, name: faq.question })).toBeInTheDocument()
  })

  it('shows the byline, date and reading time', () => {
    renderAt(`/blog/${POST.slug}`)

    expect(screen.getByText('By the Bliss Rent team')).toBeInTheDocument()
    expect(screen.getByText('Published 19 September 2026')).toBeInTheDocument()
    // (The "keep reading" cards below show a reading time too, so look in the article's own header.)
    const header = screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement
    expect(within(header).getByText(/\d+ min read/)).toBeInTheDocument()
  })

  it('has a table of contents whose links jump to each section', () => {
    const { container } = renderAt(`/blog/${POST.slug}`)

    const toc = screen.getByRole('navigation', { name: 'In this guide' })
    const links = within(toc).getAllByRole('link')
    expect(links).toHaveLength(POST.en.sections.length)
    links.forEach((link, index) => {
      expect(link).toHaveAttribute('href', `#section-${index + 1}`)
      expect(container.querySelector(`#section-${index + 1}`)).not.toBeNull()
    })
  })

  it('turns in-copy links into real links to other pages', () => {
    renderAt(`/blog/${POST.slug}`)

    // Every rental-coverage note links the Booking Terms and Contact pages.
    expect(screen.getAllByRole('link', { name: 'Booking Terms' })[0]).toHaveAttribute('href', '/booking-terms')
    expect(screen.getAllByRole('link', { name: 'contact us' })[0]).toHaveAttribute('href', '/contact')
    expect(screen.getByRole('link', { name: 'economy, sedan, SUV or luxury' })).toHaveAttribute('href', '/blog/economy-sedan-suv-or-luxury-rental-car')
  })

  it('has a breadcrumb back through the blog and its category', () => {
    renderAt(`/blog/${POST.slug}`)

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(breadcrumb).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(within(breadcrumb).getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog')
    expect(within(breadcrumb).getByRole('link', { name: 'Road trips' })).toHaveAttribute('href', '/blog/category/road-trips')
  })

  it('shows the city photo with its author/license credit for an article about a city', () => {
    renderAt('/blog/dubai-in-three-days-by-car')

    expect(screen.getByRole('img', { name: 'Dubai' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Photo: .+ · CC BY/ })).toHaveAttribute('href', expect.stringContaining('wikimedia.org'))
  })

  it('leaves the photo out when the city’s photo is not what the article is about (Hatta is not the Dubai skyline)', () => {
    renderAt(`/blog/${POST.slug}`)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Photo:/ })).not.toBeInTheDocument()
    // …but the article is still tied to its city page.
    expect(screen.getAllByRole('link', { name: 'Car rental in Dubai' }).length).toBeGreaterThan(0)
  })

  it('shows no photo for an article that is not about a city', () => {
    renderAt('/blog/documents-needed-to-rent-a-car-uae')

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Photo:/ })).not.toBeInTheDocument()
  })

  it('ends with a booking call-to-action and a link to the article’s city page', () => {
    renderAt(`/blog/${POST.slug}`)

    const cta = screen.getByRole('heading', { name: 'Ready to hit the road?' }).closest('aside') as HTMLElement
    expect(within(cta).getByRole('link', { name: 'Book a car' })).toHaveAttribute('href', '/search?mode=book')
    expect(within(cta).getByRole('link', { name: 'Car rental in Dubai' })).toHaveAttribute('href', '/locations/dubai')
    expect(within(cta).getByRole('link', { name: 'Talk to us' })).toHaveAttribute('href', '/contact')
  })

  it('links every city it covers, when an article covers more than one', () => {
    renderAt('/blog/sharjah-and-ajman-by-car')

    const cta = screen.getByRole('heading', { name: 'Ready to hit the road?' }).closest('aside') as HTMLElement
    expect(within(cta).getByRole('link', { name: 'Car rental in Sharjah' })).toHaveAttribute('href', '/locations/sharjah')
    expect(within(cta).getByRole('link', { name: 'Car rental in Ajman' })).toHaveAttribute('href', '/locations/ajman')
  })

  it('suggests other articles to read next, never the current one', () => {
    renderAt(`/blog/${POST.slug}`)

    const section = screen.getByRole('heading', { name: 'Keep reading' }).closest('section') as HTMLElement
    const next = relatedPosts(POST, 3)
    for (const post of next) expect(within(section).getByRole('link', { name: post.en.title })).toHaveAttribute('href', `/blog/${post.slug}`)
    expect(within(section).queryByRole('link', { name: POST.en.title })).not.toBeInTheDocument()
  })

  it('links to every city page from the bottom of the article', () => {
    renderAt(`/blog/${POST.slug}`)

    const cities = screen.getByRole('heading', { name: 'Car rental by city' }).closest('section') as HTMLElement
    for (const guide of CITY_GUIDES) {
      expect(within(cities).getByRole('link', { name: `Car rental in ${guide.en.name}` })).toHaveAttribute('href', `/locations/${guide.slug}`)
    }
  })

  it('renders the not-found page for an unknown article', () => {
    renderAt('/blog/does-not-exist')
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })

  it('sets the tab title, description and canonical from the article', () => {
    window.history.pushState({}, '', `/blog/${POST.slug}`)
    renderAt(`/blog/${POST.slug}`)

    expect(document.title).toBe(`${POST.en.title} — Bliss Rent`)
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(POST.en.description)
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(new RegExp(`/blog/${POST.slug}$`))
    window.history.pushState({}, '', '/')
  })

  it('adds breadcrumb, article and FAQ structured data, and removes it on leaving', () => {
    const { unmount } = renderAt(`/blog/${POST.slug}`)

    const script = document.querySelector('script[data-page-jsonld]')
    expect(script).not.toBeNull()
    const data = JSON.parse(script!.textContent ?? '{}')
    const types = data['@graph'].map((node: { '@type': string }) => node['@type'])
    expect(types).toEqual(['BreadcrumbList', 'BlogPosting', 'FAQPage'])

    const [breadcrumb, article, faq] = data['@graph']
    expect(breadcrumb.itemListElement.map((item: { name: string }) => item.name)).toEqual(['Home', 'Blog', 'Road trips', POST.en.title])
    expect(article.headline).toBe(POST.en.title)
    expect(article.datePublished).toBe(POST.publishedAt)
    expect(article.author.name).toBe('Bliss Rent')
    expect(faq.mainEntity).toHaveLength(POST.en.faqs!.length)
    // Link markup never leaks into the structured answer text.
    expect(JSON.stringify(faq)).not.toMatch(/\]\(/)

    unmount()
    expect(document.querySelector('script[data-page-jsonld]')).toBeNull()
  })

  it('uses the Arabic copy when the site language is Arabic', async () => {
    await act(async () => {
      await i18n.changeLanguage('ar')
    })
    renderAt(`/blog/${POST.slug}`)

    expect(screen.getByRole('heading', { level: 1, name: POST.ar.title })).toBeInTheDocument()
    for (const section of POST.ar.sections) expect(screen.getByRole('heading', { level: 2, name: section.heading })).toBeInTheDocument()
  })
})
