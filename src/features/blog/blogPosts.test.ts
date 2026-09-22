import { describe, it, expect } from 'vitest'
import sitemapScript from '../../../scripts/generate-sitemap.mjs?raw'
import {
  BLOG_CATEGORIES,
  BLOG_POSTS,
  findCategory,
  findPostBySlug,
  postCities,
  postCity,
  postsForCity,
  postsInCategory,
  readingMinutes,
  relatedPosts,
  type BlogCopy,
  type BlogPost,
} from '@/features/blog/blogPosts'
import { inlineLinkTargets } from '@/features/blog/richText'
import { CITY_GUIDES } from '@/features/content/cityGuides'

/** Every string in an article's copy that can carry a `[label](/path)` link. */
function allText(copy: BlogCopy): string[] {
  return [
    copy.intro,
    ...copy.sections.flatMap((section) => [...(section.paragraphs ?? []), ...(section.list ?? [])]),
    ...(copy.faqs ?? []).map((faq) => faq.answer),
  ]
}

function linkTargets(copy: BlogCopy): string[] {
  return allText(copy).flatMap(inlineLinkTargets)
}

/** The site's real, public routes an article may link to. */
const STATIC_PATHS = new Set([
  '/',
  '/book',
  '/search',
  '/car-types',
  '/locations',
  '/faqs',
  '/contact',
  '/about',
  '/booking-terms',
  '/privacy-policy',
  '/cookie-policy',
  '/manage-booking',
  '/blog',
])

function isRealRoute(target: string): boolean {
  if (STATIC_PATHS.has(target)) return true
  if (target.startsWith('http')) return true
  const city = target.match(/^\/locations\/([a-z-]+)$/)
  if (city) return CITY_GUIDES.some((guide) => guide.slug === city[1])
  const post = target.match(/^\/blog\/([a-z0-9-]+)$/)
  if (post) return BLOG_POSTS.some((entry) => entry.slug === post[1])
  const category = target.match(/^\/blog\/category\/([a-z-]+)$/)
  if (category) return BLOG_CATEGORIES.some((entry) => entry.id === category[1])
  return false
}

describe('blog data', () => {
  it('has unique, URL-safe slugs', () => {
    const slugs = BLOG_POSTS.map((post) => post.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('puts every article in a real category, and every category has at least one article', () => {
    for (const post of BLOG_POSTS) expect(findCategory(post.category), post.slug).toBeDefined()
    for (const category of BLOG_CATEGORIES) expect(postsInCategory(category.id).length, category.id).toBeGreaterThan(0)
  })

  it('only points an article at a city that has a page', () => {
    for (const post of BLOG_POSTS.filter((entry) => entry.city)) expect(postCity(post), post.slug).toBeDefined()
    for (const post of BLOG_POSTS) expect(postCities(post).length, post.slug).toBe((post.city ? 1 : 0) + (post.alsoCities?.length ?? 0))
  })

  it('gives every city page at least one article to link to', () => {
    for (const guide of CITY_GUIDES) expect(postsForCity(guide.slug).length, guide.slug).toBeGreaterThan(0)
  })

  it('dates every article with a valid ISO date', () => {
    for (const post of BLOG_POSTS) {
      expect(post.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(post.publishedAt)), post.slug).toBe(false)
      if (post.updatedAt) expect(post.updatedAt >= post.publishedAt, post.slug).toBe(true)
    }
  })

  it('keeps English titles and descriptions inside search-result limits', () => {
    for (const post of BLOG_POSTS) {
      // The tab title is "<title> — Bliss Rent" (13 more characters).
      expect(post.en.title.length, `${post.slug} title`).toBeLessThanOrEqual(50)
      expect(post.en.description.length, `${post.slug} description`).toBeGreaterThanOrEqual(80)
      expect(post.en.description.length, `${post.slug} description`).toBeLessThanOrEqual(165)
    }
  })

  it('has a full Arabic version of every article with the same shape', () => {
    for (const post of BLOG_POSTS) {
      expect(post.ar.title, post.slug).toMatch(/[؀-ۿ]/)
      expect(post.ar.description, post.slug).toMatch(/[؀-ۿ]/)
      expect(post.ar.sections.length, `${post.slug} sections`).toBe(post.en.sections.length)
      post.en.sections.forEach((section, index) => {
        const arabic = post.ar.sections[index]
        expect(arabic.paragraphs?.length ?? 0, `${post.slug} §${index + 1} paragraphs`).toBe(section.paragraphs?.length ?? 0)
        expect(arabic.list?.length ?? 0, `${post.slug} §${index + 1} list`).toBe(section.list?.length ?? 0)
      })
      expect(post.ar.faqs?.length ?? 0, `${post.slug} faqs`).toBe(post.en.faqs?.length ?? 0)
    }
  })

  it('links to the same places in both languages', () => {
    for (const post of BLOG_POSTS) {
      expect(linkTargets(post.ar).sort(), post.slug).toEqual(linkTargets(post.en).sort())
    }
  })

  it('only links to pages that exist — no broken internal links', () => {
    for (const post of BLOG_POSTS) {
      for (const target of [...linkTargets(post.en), ...linkTargets(post.ar)]) {
        expect(isRealRoute(target), `${post.slug} links to ${target}`).toBe(true)
      }
    }
  })

  it('links every article to at least one other article and to a page that books or explains the rental', () => {
    for (const post of BLOG_POSTS) {
      const targets = linkTargets(post.en)
      expect(targets.some((t) => t.startsWith('/blog/') && t !== `/blog/${post.slug}`), `${post.slug} → another article`).toBe(true)
      expect(targets.some((t) => t === '/book' || t.startsWith('/locations') || t === '/booking-terms' || t === '/contact' || t === '/search'), `${post.slug} → a service page`).toBe(true)
    }
  })

  it('never links an article to itself', () => {
    for (const post of BLOG_POSTS) {
      expect(linkTargets(post.en), post.slug).not.toContain(`/blog/${post.slug}`)
    }
  })

  it('leaves no placeholders or drafting leftovers in the copy', () => {
    for (const post of BLOG_POSTS) {
      for (const copy of [post.en, post.ar]) {
        const text = [copy.title, copy.description, copy.excerpt, ...allText(copy), ...copy.sections.map((s) => s.heading)].join('\n')
        expect(text, post.slug).not.toMatch(/\[__\]|TODO|lorem ipsum|XXX/i)
      }
    }
  })

  it('never states a rule the Booking Terms still leave blank (deposit, mileage, fuel, cancellation window, minimum age)', () => {
    for (const post of BLOG_POSTS) {
      const text = allText(post.en).join(' ')
      expect(text, post.slug).not.toMatch(/\bAED\s?\d/i)
      expect(text, post.slug).not.toMatch(/\bdeposit of\b|\bfull tank\b|\bunlimited (mileage|km)\b|\bfree cancellation\b|\bat least \d+ years\b|\bover \d+ years\b/i)
    }
  })

  it('warns every road trip that the rental is tied to the city agreed at booking', () => {
    for (const post of postsInCategory('road-trips')) {
      const targets = linkTargets(post.en)
      expect(targets, post.slug).toContain('/booking-terms')
      expect(targets, post.slug).toContain('/contact')
    }
  })

  it('finds articles by slug', () => {
    expect(findPostBySlug('dubai-to-hatta-road-trip')?.category).toBe('road-trips')
    expect(findPostBySlug('nope')).toBeUndefined()
    expect(findPostBySlug(undefined)).toBeUndefined()
  })

  it('estimates a reading time of at least one minute', () => {
    for (const post of BLOG_POSTS) {
      expect(readingMinutes(post.en), post.slug).toBeGreaterThanOrEqual(1)
      expect(readingMinutes(post.en), post.slug).toBeLessThanOrEqual(10)
    }
  })
})

describe('relatedPosts', () => {
  const some = BLOG_POSTS[0]

  it("never includes the article itself or a repeat, and respects the limit", () => {
    for (const post of BLOG_POSTS) {
      const related = relatedPosts(post, 3)
      expect(related.length, post.slug).toBe(3)
      expect(related.map((p) => p.slug), post.slug).not.toContain(post.slug)
      expect(new Set(related.map((p) => p.slug)).size, post.slug).toBe(related.length)
    }
    expect(relatedPosts(some, 2)).toHaveLength(2)
  })

  it('puts hand-picked related articles first', () => {
    const post = BLOG_POSTS.find((entry) => (entry.related?.length ?? 0) > 0) as BlogPost
    const related = relatedPosts(post, post.related!.length)
    expect(related.map((p) => p.slug)).toEqual(post.related)
  })

  it('only names related articles that exist', () => {
    for (const post of BLOG_POSTS) {
      for (const slug of post.related ?? []) expect(findPostBySlug(slug), `${post.slug} → ${slug}`).toBeDefined()
    }
  })
})

describe('sitemap', () => {
  it('lists the blog, every category and every article (with the article’s date)', () => {
    expect(sitemapScript).toContain("path: '/blog'")
    for (const category of BLOG_CATEGORIES) expect(sitemapScript, category.id).toContain(`path: '/blog/category/${category.id}'`)
    for (const post of BLOG_POSTS) {
      const lastmod = post.updatedAt ?? post.publishedAt
      expect(sitemapScript, post.slug).toContain(`path: '/blog/${post.slug}'`)
      const line = sitemapScript.split('\n').find((row) => row.includes(`path: '/blog/${post.slug}'`)) ?? ''
      expect(line, `${post.slug} lastmod`).toContain(`lastmod: '${lastmod}'`)
    }
  })

  it('lists nothing under /blog that has no article or category behind it', () => {
    const listed = Array.from(sitemapScript.matchAll(/path: '(\/blog[^']*)'/g), (match) => match[1])
    for (const path of listed) expect(isRealRoute(path), path).toBe(true)
  })
})
