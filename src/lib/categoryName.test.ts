import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import i18n from '@/i18n'
import { categoryKey, categoryLabel } from '@/lib/categoryName'

describe('categoryKey', () => {
  it('turns a stored name into a stable, language-independent key', () => {
    expect(categoryKey('Economy')).toBe('economy')
    expect(categoryKey('Sports & Supercars')).toBe('sports_supercars')
    expect(categoryKey('SUV')).toBe('suv')
  })

  it('ignores case, spacing and punctuation differences', () => {
    expect(categoryKey('  sports  &  SUPERCARS ')).toBe('sports_supercars')
    expect(categoryKey('Sports and Supercars')).toBe('sports_and_supercars')
  })

  it('never yields leading or trailing separators', () => {
    expect(categoryKey('-Luxury!')).toBe('luxury')
    expect(categoryKey('&&')).toBe('')
  })
})

describe('categoryLabel', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('shows the category in the active language', async () => {
    expect(categoryLabel(i18n.t, 'Sports & Supercars')).toBe('Sports & Supercars')

    await i18n.changeLanguage('ar')
    expect(categoryLabel(i18n.t, 'Economy')).toBe('اقتصادية')
    expect(categoryLabel(i18n.t, 'Sports & Supercars')).toBe('سيارات رياضية وخارقة')
    expect(categoryLabel(i18n.t, 'SUV')).toBe('دفع رباعي (SUV)')
    expect(categoryLabel(i18n.t, 'Luxury')).toBe('فاخرة')
  })

  it('falls back to the stored name for a category that has no translation yet', async () => {
    expect(categoryLabel(i18n.t, 'Convertible')).toBe('Convertible')
    await i18n.changeLanguage('ar')
    expect(categoryLabel(i18n.t, 'Convertible')).toBe('Convertible')
  })
})
