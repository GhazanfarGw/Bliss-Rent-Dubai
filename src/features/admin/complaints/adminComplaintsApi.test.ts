import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chainable } from '@/test/supabaseMock'

const fromMock = vi.fn()
const functionsInvokeMock = vi.fn()
const createSignedUrlMock = vi.fn()
let lastUpdatePayload: Record<string, unknown> | null = null
let lastInsertPayload: Record<string, unknown> | null = null

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    functions: { invoke: (...args: unknown[]) => functionsInvokeMock(...args) },
    storage: { from: () => ({ createSignedUrl: (...args: unknown[]) => createSignedUrlMock(...args) }) },
  },
}))

const { fetchComplaints, updateComplaint, sendComplaintReply, fetchComplaintThread, sendComplaintChatMessage, getComplaintAttachmentUrl } =
  await import('./adminComplaintsApi')

describe('adminComplaintsApi', () => {
  beforeEach(() => {
    fromMock.mockReset()
    functionsInvokeMock.mockReset()
    functionsInvokeMock.mockResolvedValue({ data: {}, error: null })
    createSignedUrlMock.mockReset()
    lastUpdatePayload = null
    lastInsertPayload = null
  })

  it('lists complaints filtered by status (Complaints / Support)', async () => {
    fromMock.mockReturnValue(chainable({ data: [{ id: 'cm1', status: 'open' }] }))
    const result = await fetchComplaints('open')
    expect(fromMock).toHaveBeenCalledWith('complaints')
    expect(result).toHaveLength(1)
  })

  it('stamps resolved_at when a complaint transitions to resolved', async () => {
    fromMock.mockImplementation(() => ({
      update: (payload: Record<string, unknown>) => {
        lastUpdatePayload = payload
        return chainable({ data: null, error: null })
      },
    }))

    await updateComplaint('cm1', { status: 'resolved', internalNotes: 'Checked with the customer.', resolution: 'Refunded the deposit.' })

    expect(lastUpdatePayload?.status).toBe('resolved')
    expect(lastUpdatePayload?.resolved_at).not.toBeNull()
    expect(lastUpdatePayload?.internal_notes).toBe('Checked with the customer.')
    expect(lastUpdatePayload?.resolution).toBe('Refunded the deposit.')
  })

  it('clears resolved_at when a complaint is reopened to in_progress', async () => {
    fromMock.mockImplementation(() => ({
      update: (payload: Record<string, unknown>) => {
        lastUpdatePayload = payload
        return chainable({ data: null, error: null })
      },
    }))

    await updateComplaint('cm1', { status: 'in_progress', internalNotes: '', resolution: '' })

    expect(lastUpdatePayload?.resolved_at).toBeNull()
    expect(lastUpdatePayload?.internal_notes).toBeNull()
  })

  it('saves the admin reply and best-effort triggers deliver-complaint-reply', async () => {
    fromMock.mockImplementation(() => ({
      update: (payload: Record<string, unknown>) => {
        lastUpdatePayload = payload
        return chainable({ data: null, error: null })
      },
    }))

    const result = await sendComplaintReply('cm1', '  Sorry about that, refund issued.  ')

    expect(lastUpdatePayload?.admin_reply_message).toBe('Sorry about that, refund issued.')
    expect(typeof lastUpdatePayload?.admin_reply_sent_at).toBe('string')
    expect(functionsInvokeMock).toHaveBeenCalledWith('deliver-complaint-reply', { body: { complaintId: 'cm1' } })
    expect(result).toEqual({ emailTriggered: true })
  })

  it('never throws when the notify trigger fails — the save already succeeded', async () => {
    fromMock.mockImplementation(() => ({
      update: () => chainable({ data: null, error: null }),
    }))
    functionsInvokeMock.mockResolvedValue({ data: null, error: { message: 'network down' } })

    const result = await sendComplaintReply('cm1', 'Reply text')

    expect(result).toEqual({ emailTriggered: false })
  })

  it('throws (does not silently swallow) when the save itself fails', async () => {
    fromMock.mockImplementation(() => ({
      update: () => chainable({ data: null, error: { message: 'permission denied' } }),
    }))

    await expect(sendComplaintReply('cm1', 'Reply text')).rejects.toThrow('permission denied')
    expect(functionsInvokeMock).not.toHaveBeenCalled()
  })

  it('fetches a complaint\'s Support Chat thread, oldest first', async () => {
    fromMock.mockReturnValue(chainable({ data: [{ id: 'msg1', sender: 'customer', body: 'Hi', image_path: null, created_at: 't1' }] }))
    const result = await fetchComplaintThread('cm1')
    expect(fromMock).toHaveBeenCalledWith('complaint_messages')
    expect(result).toHaveLength(1)
  })

  it('sends an admin chat message as an RLS-governed insert with sender fixed to admin', async () => {
    fromMock.mockImplementation(() => ({
      insert: (payload: Record<string, unknown>) => {
        lastInsertPayload = payload
        return chainable({ data: null, error: null })
      },
    }))

    await sendComplaintChatMessage('cm1', '  We are looking into it now.  ')

    expect(fromMock).toHaveBeenCalledWith('complaint_messages')
    expect(lastInsertPayload).toEqual({ complaint_id: 'cm1', sender: 'admin', body: 'We are looking into it now.' })
  })

  it('does not insert an empty chat message', async () => {
    await sendComplaintChatMessage('cm1', '   ')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('throws when saving an admin chat message fails', async () => {
    fromMock.mockImplementation(() => ({ insert: () => chainable({ data: null, error: { message: 'permission denied' } }) }))
    await expect(sendComplaintChatMessage('cm1', 'Hello')).rejects.toThrow('permission denied')
  })

  it('signs a URL for a chat attachment', async () => {
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signed.example/x.jpg' }, error: null })
    const url = await getComplaintAttachmentUrl('x.jpg')
    expect(url).toBe('https://signed.example/x.jpg')
  })

  it('returns null instead of throwing when signing a chat attachment URL fails', async () => {
    createSignedUrlMock.mockResolvedValue({ data: null, error: { message: 'not found' } })
    const url = await getComplaintAttachmentUrl('missing.jpg')
    expect(url).toBeNull()
  })
})
