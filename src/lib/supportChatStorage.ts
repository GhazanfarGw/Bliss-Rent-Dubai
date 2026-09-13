// Persists the Support Chat widget's live-chat session (see
// SupportChatWidget.tsx and supabase/migrations/20261007000000_support_chat.sql)
// across reloads — there's no customer login, so `accessToken` (a random,
// unguessable per-conversation credential, distinct from complaintId) IS
// the session: whoever's browser holds it can read/post to that thread,
// the same "guest bearer credential in storage" pattern as
// checkoutStorage.ts, and every read/write wrapped in try/catch for the
// same reason (localStorage can throw in some browser contexts).
const STORAGE_KEY = 'dxb-support-chat'

export interface SupportChatSession {
  accessToken: string
  complaintId: string
  /** Remembered so a returning visitor's start form is pre-filled instead of asked again. */
  name: string
  email: string
}

export function readSupportChatSession(): SupportChatSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SupportChatSession>
    if (typeof parsed.accessToken !== 'string' || typeof parsed.complaintId !== 'string') return null
    return {
      accessToken: parsed.accessToken,
      complaintId: parsed.complaintId,
      name: typeof parsed.name === 'string' ? parsed.name : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
    }
  } catch {
    return null
  }
}

export function storeSupportChatSession(session: SupportChatSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // best-effort only — the widget still works for this visit even if
    // the session can't be persisted (a fresh chat starts on next visit).
  }
}

export function clearSupportChatSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // best-effort only
  }
}
