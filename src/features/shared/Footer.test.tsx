import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n'
import { Footer } from '@/features/shared/Footer'
import { BLOG_POSTS } from '@/features/blog/blogPosts'
import { CITY_GUIDES } from '@/features/content/cityGuides'

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  )
}

/** The footer column that has this heading. */
function column(name: string): HTMLElement {
  return screen.getByRole('heading', { name }).parentElement as HTMLElement
}

describe('Footer', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('links to every city page from a "Car rental by city" column', () => {
    renderFooter()

    const cities = column('Car rental by city')
    for (const guide of CITY_GUIDES) {
      expect(within(cities).getByRole('link', { name: guide.en.name })).toHaveAttribute('href', `/locations/${guide.slug}`)
    }
  })

  it('links to the blog, the latest articles and the full article list', () => {
    renderFooter()

    expect(within(column('Company')).getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog')

    const guides = column('Guides & tips')
    for (const post of BLOG_POSTS.slice(0, 4)) {
      expect(within(guides).getByRole('link', { name: post.en.title })).toHaveAttribute('href', `/blog/${post.slug}`)
    }
    expect(within(guides).getByRole('link', { name: 'All articles' })).toHaveAttribute('href', '/blog')
  })

  it('loads the banner from the site root, so it also shows on nested pages like /blog/… and /locations/…', () => {
    renderFooter()

    // A relative "./footerbaner.jpg" resolves against the current URL and 404s two levels deep.
    expect(screen.getByRole('img', { name: 'Footer Logo' })).toHaveAttribute('src', '/footerbaner.jpg')
  })

  it('keeps the existing company, legal and good-to-know links', () => {
    renderFooter()

    expect(within(column('Company')).getByRole('link', { name: 'Locations' })).toHaveAttribute('href', '/locations')
    expect(within(column('Legal')).getByRole('link', { name: 'Booking Terms & Conditions' })).toHaveAttribute('href', '/booking-terms')
    expect(screen.getByText('Good to know')).toBeInTheDocument()
  })

  it('shows city names and article titles in Arabic when the site language is Arabic', async () => {
    await act(async () => {
      await i18n.changeLanguage('ar')
    })
    renderFooter()

    const cities = column('تأجير السيارات حسب المدينة')
    expect(within(cities).getByRole('link', { name: CITY_GUIDES[0].ar.name })).toHaveAttribute('href', `/locations/${CITY_GUIDES[0].slug}`)
    const guides = column('أدلة ونصائح')
    expect(within(guides).getByRole('link', { name: BLOG_POSTS[0].ar.title })).toBeInTheDocument()
  })
})
