import { describe, it, expect } from 'vitest'
import { generateNumericCode, generateSalt, hashCode, constantTimeEqual, CODE_LENGTH } from './adminLoginCode.ts'

describe('generateNumericCode', () => {
  it('produces a CODE_LENGTH-digit numeric string', () => {
    const code = generateNumericCode()
    expect(code).toHaveLength(CODE_LENGTH)
    expect(/^\d+$/.test(code)).toBe(true)
  })

  it('does not produce the same code every time', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateNumericCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})

describe('generateSalt', () => {
  it('produces a random hex string, different each call', () => {
    const a = generateSalt()
    const b = generateSalt()
    expect(/^[0-9a-f]+$/.test(a)).toBe(true)
    expect(a).not.toBe(b)
  })
})

describe('hashCode', () => {
  it('is deterministic for the same code + salt', async () => {
    const a = await hashCode('123456', 'saltA')
    const b = await hashCode('123456', 'saltA')
    expect(a).toBe(b)
  })

  it('differs when the salt differs, even for the same code', async () => {
    const a = await hashCode('123456', 'saltA')
    const b = await hashCode('123456', 'saltB')
    expect(a).not.toBe(b)
  })

  it('differs when the code differs, even for the same salt', async () => {
    const a = await hashCode('123456', 'saltA')
    const b = await hashCode('654321', 'saltA')
    expect(a).not.toBe(b)
  })
})

describe('constantTimeEqual', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEqual('abc123', 'abc123')).toBe(true)
  })

  it('returns false for different strings of the same length', () => {
    expect(constantTimeEqual('abc123', 'abc124')).toBe(false)
  })

  it('returns false for different-length strings without throwing', () => {
    expect(constantTimeEqual('abc', 'abcdef')).toBe(false)
  })
})
