import { supabase } from '@/lib/supabaseClient'

/**
 * Typed client for the Support Chat Edge Functions (support-chat-start /
 * support-chat-message / support-chat-thread — see
 * supabase/migrations/20261007000000_support_chat.sql). Same
 * error-unwrapping shape as checkout/checkoutApi.ts: supabase-js only
 * exposes a failed function's real `{code, message, fieldErrors}` body on
 * `error.context` (the raw Response), so that has to be parsed out
 * explicitly rather than trusting `error.message`.
 */
export class SupportChatApiError extends Error {
  code: string
  fieldErrors?: Record<string, string>

  constructor(body: { code?: string; message?: string; fieldErrors?: Record<string, string> }) {
    super(body.message ?? 'Something went wrong.')
    this.code = body.code ?? 'SERVER_ERROR'
    this.fieldErrors = body.fieldErrors
  }
}

async function invoke<T>(fn: 'support-chat-start' | 'support-chat-message' | 'support-chat-thread', body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })

  if (error) {
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const parsed = await context.clone().json()
        throw new SupportChatApiError(parsed)
      } catch (parseError) {
        if (parseError instanceof SupportChatApiError) throw parseError
        // fall through to the generic error below
      }
    }
    throw new SupportChatApiError({ code: 'SERVER_ERROR', message: error.message })
  }

  return data as T
}

// Mirrors supabase/functions/_shared/imageUpload.ts exactly — validating
// client-side first avoids a round trip (and, more importantly, avoids
// ever base64-encoding and uploading a file the server will reject
// anyway) for the obviously-wrong cases; the server-side check is still
// the one that actually matters and is not relaxed by this.
export const SUPPORT_CHAT_MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const SUPPORT_CHAT_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Reads a File into the base64 payload (no `data:...;base64,` prefix) these Edge Functions expect. */
export function readImageAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the selected file.'))
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.readAsDataURL(file)
  })
}

export interface SupportChatImageInput {
  imageBase64: string
  imageMimeType: string
}

export interface StartSupportChatRequest {
  fullName: string
  email: string
  phone?: string
  message: string
  image?: SupportChatImageInput
}

export interface StartSupportChatResult {
  complaintId: string
  accessToken: string
  status: string
}

export function startSupportChat(req: StartSupportChatRequest): Promise<StartSupportChatResult> {
  return invoke<StartSupportChatResult>('support-chat-start', {
    fullName: req.fullName,
    email: req.email,
    phone: req.phone,
    message: req.message,
    imageBase64: req.image?.imageBase64,
    imageMimeType: req.image?.imageMimeType,
  })
}

export interface SendSupportChatMessageRequest {
  accessToken: string
  message?: string
  image?: SupportChatImageInput
}

export interface SendSupportChatMessageResult {
  messageId: string
  createdAt: string
}

export function sendSupportChatMessage(req: SendSupportChatMessageRequest): Promise<SendSupportChatMessageResult> {
  return invoke<SendSupportChatMessageResult>('support-chat-message', {
    accessToken: req.accessToken,
    message: req.message,
    imageBase64: req.image?.imageBase64,
    imageMimeType: req.image?.imageMimeType,
  })
}

export interface SupportChatThreadMessage {
  id: string
  sender: 'customer' | 'admin'
  body: string | null
  imageUrl: string | null
  createdAt: string
}

export interface SupportChatThreadResult {
  complaintId: string
  status: string
  messages: SupportChatThreadMessage[]
}

export function fetchSupportChatThread(accessToken: string): Promise<SupportChatThreadResult> {
  return invoke<SupportChatThreadResult>('support-chat-thread', { accessToken })
}
