import { describe, it, expect } from 'vitest'
import { getResendSenderConfig, type EnvLike } from './emailSenderConfig.ts'

function fakeEnv(vars: Record<string, string | undefined>): EnvLike {
  return { get: (key: string) => vars[key] }
}

describe('getResendSenderConfig', () => {
  it('uses RESEND_FROM_ADDRESS for customer emails', () => {
    const env = fakeEnv({ RESEND_API_KEY: 'key', RESEND_FROM_ADDRESS: 'Bliss Rent <booking@bliss.rent>' })
    expect(getResendSenderConfig('customer', env)).toEqual({
      apiKey: 'key',
      fromAddress: 'Bliss Rent <booking@bliss.rent>',
      replyTo: undefined,
    })
  })

  it('uses RESEND_FROM_ADDRESS_ADMIN for admin emails when set', () => {
    const env = fakeEnv({
      RESEND_API_KEY: 'key',
      RESEND_FROM_ADDRESS: 'Bliss Rent <booking@bliss.rent>',
      RESEND_FROM_ADDRESS_ADMIN: 'Bliss Rent <admin@bliss.rent>',
    })
    expect(getResendSenderConfig('admin', env).fromAddress).toBe('Bliss Rent <admin@bliss.rent>')
  })

  it('falls back to RESEND_FROM_ADDRESS for admin emails when RESEND_FROM_ADDRESS_ADMIN is unset', () => {
    const env = fakeEnv({ RESEND_API_KEY: 'key', RESEND_FROM_ADDRESS: 'Bliss Rent <booking@bliss.rent>' })
    expect(getResendSenderConfig('admin', env).fromAddress).toBe('Bliss Rent <booking@bliss.rent>')
  })

  it('falls back to hardcoded defaults when nothing is configured at all', () => {
    const env = fakeEnv({})
    expect(getResendSenderConfig('customer', env).fromAddress).toBe('Bliss Rent <booking@bliss.rent>')
    expect(getResendSenderConfig('admin', env).fromAddress).toBe('Bliss Rent <admin@bliss.rent>')
  })

  it('includes replyTo when RESEND_REPLY_TO is set, trimmed', () => {
    const env = fakeEnv({ RESEND_REPLY_TO: '  support@bliss.rent  ' })
    expect(getResendSenderConfig('customer', env).replyTo).toBe('support@bliss.rent')
  })

  it('omits replyTo when RESEND_REPLY_TO is unset or blank', () => {
    expect(getResendSenderConfig('customer', fakeEnv({})).replyTo).toBeUndefined()
    expect(getResendSenderConfig('customer', fakeEnv({ RESEND_REPLY_TO: '   ' })).replyTo).toBeUndefined()
  })

  it('reads the API key the same way regardless of category', () => {
    const env = fakeEnv({ RESEND_API_KEY: 'shared-key' })
    expect(getResendSenderConfig('customer', env).apiKey).toBe('shared-key')
    expect(getResendSenderConfig('admin', env).apiKey).toBe('shared-key')
  })
})
