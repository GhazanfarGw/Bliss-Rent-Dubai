import { describe, it, expect, vi } from 'vitest'
import { dispatchPlateConfirmedWhatsapp, type WhatsappNotificationSource } from './dispatchPlateConfirmedWhatsapp.ts'

function fakeSource(result: { data: { id: string } | null; error: { message: string } | null }): {
  source: WhatsappNotificationSource
  updateSpy: ReturnType<typeof vi.fn>
  eqSpy: ReturnType<typeof vi.fn>
} {
  const eqSpy = vi.fn()
  const updateSpy = vi.fn((_values: Record<string, unknown>) => ({
    eq: (col1: string, val1: string) => {
      eqSpy(col1, val1)
      return {
        eq: (col2: string, val2: string) => {
          eqSpy(col2, val2)
          return {
            select: () => ({
              maybeSingle: async () => result,
            }),
          }
        },
      }
    },
  }))
  return {
    source: { from: () => ({ update: updateSpy }) } as unknown as WhatsappNotificationSource,
    updateSpy,
    eqSpy,
  }
}

describe('dispatchPlateConfirmedWhatsapp', () => {
  it("transitions a pending_delivery row to 'not_configured' when no WHATSAPP_PROVIDER is set — never invents a vendor", async () => {
    const { source, updateSpy, eqSpy } = fakeSource({ data: { id: 'notif-1' }, error: null })
    const getEnv = vi.fn(() => undefined)

    const outcome = await dispatchPlateConfirmedWhatsapp({ dataSource: source, getEnv }, 'notif-1')

    expect(outcome).toEqual({ status: 'not_configured' })
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ whatsapp_status: 'not_configured' }))
    expect(eqSpy).toHaveBeenCalledWith('id', 'notif-1')
    expect(eqSpy).toHaveBeenCalledWith('whatsapp_status', 'pending_delivery')
  })

  it('also treats an empty/whitespace-only WHATSAPP_PROVIDER value as unset', async () => {
    const { source } = fakeSource({ data: { id: 'notif-1' }, error: null })
    const getEnv = vi.fn(() => '   ')

    const outcome = await dispatchPlateConfirmedWhatsapp({ dataSource: source, getEnv }, 'notif-1')

    expect(outcome).toEqual({ status: 'not_configured' })
  })

  it("returns 'already_resolved' (not an error) when the compare-and-swap matches no row — another attempt already resolved it", async () => {
    const { source } = fakeSource({ data: null, error: null })
    const getEnv = vi.fn(() => undefined)

    const outcome = await dispatchPlateConfirmedWhatsapp({ dataSource: source, getEnv }, 'notif-1')

    expect(outcome).toEqual({ status: 'already_resolved' })
  })

  it('reports a DB error as a failed outcome rather than throwing', async () => {
    const { source } = fakeSource({ data: null, error: { message: 'connection reset' } })
    const getEnv = vi.fn(() => undefined)

    const outcome = await dispatchPlateConfirmedWhatsapp({ dataSource: source, getEnv }, 'notif-1')

    expect(outcome).toEqual({ status: 'failed', errorMessage: 'connection reset' })
  })

  it('never calls a real vendor when WHATSAPP_PROVIDER is set to an unimplemented value — reports failed with the exact provider name', async () => {
    const { source, updateSpy } = fakeSource({ data: { id: 'notif-1' }, error: null })
    const getEnv = vi.fn((name: string) => (name === 'WHATSAPP_PROVIDER' ? 'twilio' : undefined))

    const outcome = await dispatchPlateConfirmedWhatsapp({ dataSource: source, getEnv }, 'notif-1')

    expect(outcome).toEqual({ status: 'failed', errorMessage: 'WHATSAPP_PROVIDER="twilio" is not a recognized/implemented provider yet.' })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('reads the WHATSAPP_PROVIDER env var by exact name', async () => {
    const { source } = fakeSource({ data: { id: 'notif-1' }, error: null })
    const getEnv = vi.fn(() => undefined)

    await dispatchPlateConfirmedWhatsapp({ dataSource: source, getEnv }, 'notif-1')

    expect(getEnv).toHaveBeenCalledWith('WHATSAPP_PROVIDER')
  })
})
