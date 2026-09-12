import { describe, it, expect } from 'vitest'
import { checkTestSendAllowed } from './testModeConfig.ts'

describe('checkTestSendAllowed', () => {
  it('denies when TEST_MODE is unset', () => {
    const result = checkTestSendAllowed('qa@bliss.rent', { testModeRaw: undefined, allowlistRaw: 'qa@bliss.rent' })
    expect(result).toEqual({ allowed: false, reason: 'TEST_MODE_DISABLED' })
  })

  it('denies when TEST_MODE is explicitly false', () => {
    const result = checkTestSendAllowed('qa@bliss.rent', { testModeRaw: 'false', allowlistRaw: 'qa@bliss.rent' })
    expect(result).toEqual({ allowed: false, reason: 'TEST_MODE_DISABLED' })
  })

  it('denies when TEST_MODE is a typo/garbage value — fails closed, not open', () => {
    const result = checkTestSendAllowed('qa@bliss.rent', { testModeRaw: 'yes', allowlistRaw: 'qa@bliss.rent' })
    expect(result).toEqual({ allowed: false, reason: 'TEST_MODE_DISABLED' })
  })

  it('accepts TEST_MODE case-insensitively', () => {
    const result = checkTestSendAllowed('qa@bliss.rent', { testModeRaw: 'TRUE', allowlistRaw: 'qa@bliss.rent' })
    expect(result).toEqual({ allowed: true })
  })

  it('denies an unconfigured (empty) allowlist even with TEST_MODE on — unconfigured means permit nothing', () => {
    const result = checkTestSendAllowed('qa@bliss.rent', { testModeRaw: 'true', allowlistRaw: undefined })
    expect(result).toEqual({ allowed: false, reason: 'RECIPIENT_NOT_ALLOWLISTED' })
  })

  it('denies a recipient not on the allowlist', () => {
    const result = checkTestSendAllowed('stranger@example.com', { testModeRaw: 'true', allowlistRaw: 'qa@bliss.rent,dev@bliss.rent' })
    expect(result).toEqual({ allowed: false, reason: 'RECIPIENT_NOT_ALLOWLISTED' })
  })

  it('accepts a recipient on the allowlist, matching case-insensitively and trimming whitespace', () => {
    const result = checkTestSendAllowed('  QA@Bliss.Rent  ', { testModeRaw: 'true', allowlistRaw: 'qa@bliss.rent, dev@bliss.rent' })
    expect(result).toEqual({ allowed: true })
  })

  it('reports TEST_MODE_DISABLED (not RECIPIENT_NOT_ALLOWLISTED) when both safeguards would fail', () => {
    const result = checkTestSendAllowed('stranger@example.com', { testModeRaw: undefined, allowlistRaw: undefined })
    expect(result).toEqual({ allowed: false, reason: 'TEST_MODE_DISABLED' })
  })
})
