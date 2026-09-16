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

  it('returns null for a make no library carries, rather than a fabricated mark', () => {
    expect(getBrandLogo('Lexus')).toBeNull()
    expect(getBrandLogo('GMC')).toBeNull()
    expect(getBrandLogo('Genesis')).toBeNull()
  })

  it('carries Mercedes-Benz and Land Rover from a second source (cardog-ai/icons), on their own 512x512 canvas', () => {
    const mb = getBrandLogo('Mercedes-Benz')
    expect(mb?.viewBox).toBe('0 0 512 512')
    expect(mb?.extraPaths?.length).toBeGreaterThan(0)

    const landRover = getBrandLogo('Land Rover')
    expect(landRover?.viewBox).toBe('0 0 512 512')
    expect(landRover?.extraPaths?.length).toBeGreaterThan(0)
  })

  it('carries Range Rover, Brabus, and Mansory from Wikimedia Commons as vector marks', () => {
    expect(getBrandLogo('Range Rover')?.extraPaths?.length).toBeGreaterThan(0)
    expect(getBrandLogo('Brabus')?.transform).toBeTruthy()
    expect(getBrandLogo('Mansory')?.extraPaths?.length).toBeGreaterThan(0)
  })

  it('carries JAC as a raster image, since no vector source exists for it', () => {
    const jac = getBrandLogo('JAC')
    expect(jac?.image).toBeTruthy()
  })

  it('returns null for an unrecognized make', () => {
    expect(getBrandLogo('Not A Real Brand')).toBeNull()
  })
})
