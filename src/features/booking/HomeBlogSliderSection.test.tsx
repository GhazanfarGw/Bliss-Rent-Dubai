import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomeBlogSliderSection } from '@/features/booking/HomeBlogSliderSection'
import { BLOG_POSTS } from '@/features/blog/blogPosts'

function renderIt() {
  return render(
    <MemoryRouter>
      <HomeBlogSliderSection />
    </MemoryRouter>,
  )
}

describe('HomeBlogSliderSection', () => {
  it('opens with a small heading above the big one', () => {
    renderIt()
    const heading = screen.getByRole('heading', { name: 'Read up before you drive' })
    const section = heading.closest('section') as HTMLElement
    expect(within(section).getByText('The Bliss blog')).toBeInTheDocument()
    // The small heading comes first in the document.
    expect(
      within(section).getByText('The Bliss blog').compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('slides every article, each with a picture and a link to its own page', () => {
    renderIt()
    const carousel = screen.getByRole('region', { name: 'Blog articles carousel' })
    const slides = within(carousel).getAllByRole('group')
    expect(slides).toHaveLength(BLOG_POSTS.length)
    for (const slide of slides) {
      const image = slide.querySelector('img')
      expect(image).not.toBeNull()
      expect(image?.getAttribute('src')).toBeTruthy()
      expect(within(slide).getByRole('link').getAttribute('href')).toMatch(/^\/blog\/[a-z0-9-]+$/)
    }
  })

  it('shows a different generated image for every article, including later slides', () => {
    renderIt()
    const carousel = screen.getByRole('region', { name: 'Blog articles carousel' })
    const sources = Array.from(carousel.querySelectorAll('img'), (image) => image.getAttribute('src'))
    expect(sources).toHaveLength(BLOG_POSTS.length)
    expect(new Set(sources).size).toBe(BLOG_POSTS.length)
    for (const source of sources) expect(source).toMatch(/\/assets\/blog\/.+-generated\.webp$/)
  })

  it('links to the full blog and has working previous/next controls', () => {
    renderIt()
    expect(screen.getByRole('link', { name: 'View all articles' })).toHaveAttribute('href', '/blog')
    // jsdom has no layout, so this only proves the buttons are wired up and don't throw.
    fireEvent.click(screen.getByRole('button', { name: 'Next articles' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous articles' }))
  })
})
