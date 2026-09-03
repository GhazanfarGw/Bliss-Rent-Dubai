import { describe, it, expect } from 'vitest'
import { getBrandLogo } from '@/lib/carBrandLogos'

describe('getBrandLogo', () => {
  it('returns the real simple-icons mark for a known brand', () => {
    const logo = getBrandLogo('Toyota')
    expect(logo).not.toBeNull()
    expect(logo?.title).toBe('Toyota')
    expect(logo?.hex).toMatch(/^[0-9A-Fa-f]{6}$/)
    expect(logo?.path.length).toBeGreaterThan(0)
  })

  it('normalizes case, spaces, and punctuation so "Rolls Royce" matches "rollsroyce"', () => {
    expect(getBrandLogo('Rolls Royce')).toEqual(getBrandLogo('rollsroyce'))
    expect(getBrandLogo('Rolls-Royce')).toEqual(getBrandLogo('rollsroyce'))
  })

  it('maps common aliases to the same brand mark', () => {
    expect(getBrandLogo('Chevy')).toEqual(getBrandLogo('Chevrolet'))
    expect(getBrandLogo('VW')).toEqual(getBrandLogo('Volkswagen'))
  })

  it('returns null for a make the library does not carry, rather than a fabricated mark', () => {
    expect(getBrandLogo('Land Rover')).toBeNull()
    expect(getBrandLogo('GMC')).toBeNull()
    expect(getBrandLogo('Mercedes-Benz')).toBeNull()
  })

  it('returns null for an unrecognized make', () => {
    expect(getBrandLogo('Not A Real Brand')).toBeNull()
  })
})
