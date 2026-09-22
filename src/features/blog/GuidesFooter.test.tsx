import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GuidesFooter } from '@/features/blog/GuidesFooter'
import { findPostBySlug } from '@/features/blog/blogPosts'

function renderIt(slugs: string[]) {
  return render(
    <MemoryRouter>
      <GuidesFooter slugs={slugs} />
    </MemoryRouter>,
  )
}

describe('GuidesFooter', () => {
  it('shows the picked articles as cards linking to them, in the order given, with a link to the whole blog', () => {
    renderIt(['dubai-to-hatta-road-trip', 'documents-needed-to-rent-a-car-uae'])

    const section = screen.getByRole('heading', { name: 'Guides for your UAE trip' }).closest('section') as HTMLElement
    const links = within(section)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'))
    expect(links).toEqual(['/blog', '/blog/dubai-to-hatta-road-trip', '/blog/documents-needed-to-rent-a-car-uae'])
    expect(within(section).getByRole('link', { name: findPostBySlug('dubai-to-hatta-road-trip')!.en.title })).toBeInTheDocument()
  })

  it('skips a slug that has no article rather than rendering a broken card', () => {
    renderIt(['not-a-real-article', 'dubai-to-hatta-road-trip'])

    expect(screen.getAllByRole('article')).toHaveLength(1)
  })

  it('renders nothing at all when none of the slugs match', () => {
    const { container } = renderIt(['nope', 'also-nope'])

    expect(container).toBeEmptyDOMElement()
  })
})
