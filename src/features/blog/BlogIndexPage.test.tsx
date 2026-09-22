import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import i18n from '@/i18n'
import { BlogIndexPage } from '@/features/blog/BlogIndexPage'
import { BLOG_CATEGORIES, BLOG_POSTS, postsInCategory } from '@/features/blog/blogPosts'
import { CITY_GUIDES } from '@/features/content/cityGuides'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/blog" element={<BlogIndexPage />} />
        <Route path="/blog/category/:category" element={<BlogIndexPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BlogIndexPage', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
    document.querySelectorAll('script[data-page-jsonld]').forEach((el) => el.remove())
  })

  it('lists every article as a card linking to its own page', () => {
    renderAt('/blog')

    expect(screen.getByRole('heading', { level: 1, name: 'Car rental guides & UAE travel tips' })).toBeInTheDocument()
    // One role query for every link (a role query per article is slow on a page this size).
    const hrefByName = new Map(screen.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]))
    for (const post of BLOG_POSTS) expect(hrefByName.get(post.en.title), post.slug).toBe(`/blog/${post.slug}`)
  })

  it('offers every category as a real link, with the current one marked', () => {
    renderAt('/blog')

    const nav = screen.getByRole('navigation', { name: 'Article categories' })
    expect(within(nav).getByRole('link', { name: 'All articles' })).toHaveAttribute('aria-current', 'page')
    for (const category of BLOG_CATEGORIES) {
      expect(within(nav).getByRole('link', { name: category.en.name })).toHaveAttribute('href', `/blog/category/${category.id}`)
    }
  })

  it('narrows a category page to that category’s articles only', () => {
    renderAt('/blog/category/road-trips')

    expect(screen.getByRole('heading', { level: 1, name: 'Road trips' })).toBeInTheDocument()
    const shown = new Set(screen.getAllByRole('link').map((a) => a.textContent))
    for (const post of postsInCategory('road-trips')) expect(shown.has(post.en.title), post.slug).toBe(true)
    for (const post of BLOG_POSTS.filter((entry) => entry.category !== 'road-trips')) expect(shown.has(post.en.title), post.slug).toBe(false)

    const nav = screen.getByRole('navigation', { name: 'Article categories' })
    expect(within(nav).getByRole('link', { name: 'Road trips' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'All articles' })).not.toHaveAttribute('aria-current')
  })

  it('renders the not-found page for an unknown category', () => {
    renderAt('/blog/category/nope')
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })

  it('links to every city page, with keyword-rich text', () => {
    renderAt('/blog')

    const hrefByName = new Map(screen.getAllByRole('link').map((a) => [a.textContent?.trim(), a.getAttribute('href')]))
    for (const guide of CITY_GUIDES) expect(hrefByName.get(`Car rental in ${guide.en.name}`), guide.slug).toBe(`/locations/${guide.slug}`)
  })

  it('sets the tab title, description and canonical', () => {
    window.history.pushState({}, '', '/blog')
    renderAt('/blog')

    expect(document.title).toBe('Blog: car rental guides & UAE travel tips — Bliss Rent')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toMatch(/car in the UAE/i)
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(/\/blog$/)
    window.history.pushState({}, '', '/')
  })

  it('adds breadcrumb + blog structured data listing the articles', () => {
    renderAt('/blog')

    const script = document.querySelector('script[data-page-jsonld]')
    const data = JSON.parse(script?.textContent ?? '{}')
    const [breadcrumb, blog] = data['@graph']
    expect(breadcrumb['@type']).toBe('BreadcrumbList')
    expect(blog['@type']).toBe('Blog')
    expect(blog.blogPost).toHaveLength(BLOG_POSTS.length)
  })

  it('uses the Arabic copy when the site language is Arabic', async () => {
    await act(async () => {
      await i18n.changeLanguage('ar')
    })
    renderAt('/blog')

    expect(screen.getByRole('heading', { level: 1, name: 'أدلة تأجير السيارات ونصائح السفر في الإمارات' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: BLOG_POSTS[0].ar.title })).toBeInTheDocument()
  })
})
