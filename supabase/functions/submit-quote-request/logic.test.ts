import { describe, expect, it, vi } from 'vitest'
import { handleSubmitQuoteRequest, normalizePhone } from './logic.ts'

describe('normalizePhone', () => {
  it('defaults local UAE numbers to +971', () => {
    expect(normalizePhone('050 123 4567')).toBe('+971501234567')
    expect(normalizePhone('501234567')).toBe('+971501234567')
    expect(normalizePhone('00971 50 123 4567')).toBe('+971501234567')
    expect(normalizePhone('971501234567')).toBe('+971501234567')
  })
  it('keeps international numbers', () => {
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123')
    expect(normalizePhone('+92 300 1234567')).toBe('+923001234567')
  })
  it('rejects junk', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone('12')).toBeNull()
    expect(normalizePhone('abc')).toBeNull()
  })
})

describe('handleSubmitQuoteRequest', () => {
  it('silently discards honeypot submissions without touching the database', async () => {
    const rpc = vi.fn()
    const result = await handleSubmitQuoteRequest({ fullName: 'Bot', phone: '0501234567', website: 'spam.example' }, { rpc })
    expect(result).toEqual({ leadId: null, discarded: true })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns field errors for bad input', async () => {
    const rpc = vi.fn()
    await expect(handleSubmitQuoteRequest({ fullName: 'A', phone: 'x' }, { rpc })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      fieldErrors: { fullName: expect.any(String), phone: expect.any(String) },
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a return date before the pickup date', async () => {
    const rpc = vi.fn()
    await expect(
      handleSubmitQuoteRequest({ fullName: 'Ali', phone: '0501234567', startDate: '2026-11-05', endDate: '2026-11-01' }, { rpc }),
    ).rejects.toMatchObject({ fieldErrors: { endDate: expect.any(String) } })
  })

  it('normalises the phone and passes only valid uuids to the RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'lead-1', error: null })
    const result = await handleSubmitQuoteRequest(
      { fullName: ' Sara ', phone: '050 123 4567', vehicleId: 'not-a-uuid', utmSource: 'meta', startDate: '2026-11-01', endDate: '2026-11-04' },
      { rpc },
    )
    expect(result).toEqual({ leadId: 'lead-1', discarded: false })
    expect(rpc).toHaveBeenCalledWith('submit_quote_request_public', expect.objectContaining({
      p_full_name: 'Sara',
      p_phone: '+971501234567',
      p_vehicle_id: null,
      p_utm_source: 'meta',
      p_start_date: '2026-11-01',
      p_end_date: '2026-11-04',
    }))
  })

  it('surfaces the SQL rate-limit message to the guest', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'We already have your request — our team will contact you shortly.' } })
    await expect(handleSubmitQuoteRequest({ fullName: 'Sara', phone: '0501234567' }, { rpc })).rejects.toMatchObject({
      message: 'We already have your request — our team will contact you shortly.',
    })
  })
})
