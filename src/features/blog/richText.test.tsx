import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { InlineText, inlineLinkTargets, parseInline, stripInline } from '@/features/blog/richText'

describe('parseInline', () => {
  it('returns plain text untouched', () => {
    expect(parseInline('Just words.')).toEqual(['Just words.'])
  })

  it('splits text around links, keeping order', () => {
    expect(parseInline('See [our Dubai page](/locations/dubai) and [FAQs](/faqs).')).toEqual([
      'See ',
      { label: 'our Dubai page', href: '/locations/dubai' },
      ' and ',
      { label: 'FAQs', href: '/faqs' },
      '.',
    ])
  })

  it('handles a link at the very start or end', () => {
    expect(parseInline('[Book](/book) today')).toEqual([{ label: 'Book', href: '/book' }, ' today'])
    expect(parseInline('Go to [Book](/book)')).toEqual(['Go to ', { label: 'Book', href: '/book' }])
  })

  it('leaves brackets that are not a link alone', () => {
    expect(parseInline('a [note] (aside)')).toEqual(['a [note] (aside)'])
  })
})

describe('stripInline / inlineLinkTargets', () => {
  it('replaces link markup with its label', () => {
    expect(stripInline('Read [the guide](/blog/x) first.')).toBe('Read the guide first.')
  })

  it('lists every link target', () => {
    expect(inlineLinkTargets('[a](/one) and [b](https://example.com/two)')).toEqual(['/one', 'https://example.com/two'])
  })
})

describe('InlineText', () => {
  it('renders internal links as in-app links and external ones in a new tab', () => {
    render(
      <MemoryRouter>
        <p>
          <InlineText text="Go [home](/) or visit [Wikipedia](https://en.wikipedia.org)." />
        </p>
      </MemoryRouter>,
    )
    const internal = screen.getByRole('link', { name: 'home' })
    expect(internal).toHaveAttribute('href', '/')
    expect(internal).not.toHaveAttribute('target')

    const external = screen.getByRole('link', { name: 'Wikipedia' })
    expect(external).toHaveAttribute('href', 'https://en.wikipedia.org')
    expect(external).toHaveAttribute('target', '_blank')
    expect(external).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })
})
