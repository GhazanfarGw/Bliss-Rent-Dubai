import { describe, it, expect } from 'vitest'
import sitemapScript from '../../../scripts/generate-sitemap.mjs?raw'
import { CITY_GUIDES, cityPagePath, findGuideBySlug, type CityCopy } from '@/features/content/cityGuides'
import { CITY_PHOTOS } from '@/features/booking/cityPhotos'

describe('CITY_GUIDES', () => {
  it('has unique slugs that are safe URL segments', () => {
    const slugs = CITY_GUIDES.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z]+(-[a-z]+)*$/)
  })

  it('covers exactly the cities that have a photo, so every page can show one', () => {
    expect(CITY_GUIDES.map((g) => g.city).sort()).toEqual(Object.keys(CITY_PHOTOS).sort())
  })

  it.each(CITY_GUIDES.flatMap((g) => [[g.city, 'en', g.en] as const, [g.city, 'ar', g.ar] as const]))(
    '%s (%s) has a complete, well-formed copy block',
    (_city, _lang, copy: CityCopy) => {
      expect(copy.name.trim()).not.toBe('')
      expect(copy.tagline.trim()).not.toBe('')
      // Search snippets cut off past ~160 characters.
      expect(copy.metaDescription.length).toBeGreaterThan(50)
      expect(copy.metaDescription.length).toBeLessThanOrEqual(200)
      expect(copy.intro).toHaveLength(2)
      expect(copy.highlights).toHaveLength(4)
      expect(copy.drivingTips).toHaveLength(3)
      for (const text of [...copy.intro, ...copy.drivingTips, ...copy.highlights.flatMap((h) => [h.title, h.body])]) {
        expect(text.trim().length).toBeGreaterThan(5)
      }
    },
  )

  it('writes the Arabic copy in Arabic script, not English left in by mistake', () => {
    for (const guide of CITY_GUIDES) {
      expect(guide.ar.name).toMatch(/[\u0600-\u06FF]/)
      expect(guide.ar.tagline).toMatch(/[\u0600-\u06FF]/)
      for (const paragraph of guide.ar.intro) expect(paragraph).toMatch(/[\u0600-\u06FF]/)
    }
  })

  it('is listed in the sitemap generator (scripts/generate-sitemap.mjs), so every city page gets indexed', () => {
    for (const guide of CITY_GUIDES) expect(sitemapScript).toContain(`path: '/locations/${guide.slug}'`)
  })
})

describe('findGuideBySlug / cityPagePath', () => {
  it('finds a guide by slug, and nothing for an unknown or missing one', () => {
    expect(findGuideBySlug('abu-dhabi')?.city).toBe('Abu Dhabi')
    expect(findGuideBySlug('atlantis')).toBeUndefined()
    expect(findGuideBySlug(undefined)).toBeUndefined()
  })

  it('maps a locations.city value to its page path, or null when it has none', () => {
    expect(cityPagePath('Ras Al Khaimah')).toBe('/locations/ras-al-khaimah')
    expect(cityPagePath('Al Reef Village')).toBeNull()
  })
})
