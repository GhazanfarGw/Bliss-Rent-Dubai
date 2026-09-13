// support-chat-message — pure, framework-free request handler. Same split
// rationale as every other function in this repo — see create-booking/logic.ts.
//
// Appends one follow-up customer message (text and/or a photo) to a
// conversation support-chat-start already opened, identified by the
// access_token SupportChatWidget.tsx keeps in localStorage — never by
// complaint_id, which a guest is never given.
import { ApiError } from '../_shared/errors.ts'
import { decodeImageUpload } from '../_shared/imageUpload.ts'

export interface SupportChatMessageRequestBody {
  accessToken?: string
  message?: string
  imageBase64?: string
  imageMimeType?: string
}

export interface SupportChatMessageResult {
  messageId: string
  createdAt: string
}

export interface SupabaseLike {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }>
  uploadImage(path: string, bytes: Uint8Array, contentType: string): Promise<{ error: { message: string } | null }>
}

/**
 * post_support_chat_message_public() only ever raises a plain Postgres
 * exception with a message already safe to show a guest verbatim,
 * including "conversation not found" for a stale/unknown token — same
 * convention as submit-complaint/logic.ts's mapComplaintError.
 */
function mapSupportChatError(message: string): ApiError {
  return new ApiError('VALIDATION_ERROR', message || 'We could not send your message. Please try again.', 422)
}

export async function handleSupportChatMessage(
  body: SupportChatMessageRequestBody,
  supabase: SupabaseLike,
): Promise<SupportChatMessageResult> {
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const hasImage = typeof body.imageBase64 === 'string' && body.imageBase64.length > 0

  if (!accessToken) {
    throw new ApiError('VALIDATION_ERROR', 'This conversation could not be found. Please start a new chat.', 422)
  }
  if (!message && !hasImage) {
    throw new ApiError('VALIDATION_ERROR', 'Please enter a message.', 422, { message: 'Please enter a message.' })
  }

  let imagePath: string | null = null
  if (hasImage) {
    const decoded = decodeImageUpload(body.imageBase64 as string, body.imageMimeType ?? '')
    const { error: uploadError } = await supabase.uploadImage(decoded.path, decoded.bytes, decoded.contentType)
    if (uploadError) {
      throw new ApiError('SERVER_ERROR', 'Your photo could not be uploaded. Please try again.', 500)
    }
    imagePath = decoded.path
  }

  const { data, error } = await supabase.rpc('post_support_chat_message_public', {
    p_access_token: accessToken,
    p_message: message || null,
    p_image_path: imagePath,
  })

  if (error) throw mapSupportChatError(error.message)
  const row = data?.[0]
  if (!row) {
    throw new ApiError('SERVER_ERROR', 'Your message did not go through. Please try again.', 500)
  }

  return {
    messageId: row.message_id as string,
    createdAt: row.created_at as string,
  }
}
