// support-chat-start — pure, framework-free request handler. Same split
// rationale as every other function in this repo — see create-booking/logic.ts.
//
// Opens a new Support Chat conversation: validates exactly what
// SupportChatWidget.tsx's start form already validates client-side (name,
// a plausible email, a message or a photo), uploads the optional photo,
// then calls start_support_chat_public() — same "SQL function does the
// customer upsert + insert atomically" shape as submit-complaint/logic.ts.
import { ApiError } from '../_shared/errors.ts'
import { decodeImageUpload } from '../_shared/imageUpload.ts'

export interface SupportChatStartRequestBody {
  fullName?: string
  email?: string
  phone?: string
  message?: string
  imageBase64?: string
  imageMimeType?: string
}

export interface SupportChatStartResult {
  complaintId: string
  accessToken: string
  status: string
}

export interface SupabaseLike {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }>
  uploadImage(path: string, bytes: Uint8Array, contentType: string): Promise<{ error: { message: string } | null }>
}

const EMAIL_RE = /^\S+@\S+\.\S+$/

/**
 * start_support_chat_public() only ever raises a plain Postgres exception
 * with a message already safe to show a guest verbatim — same convention
 * as submit-complaint/logic.ts's mapComplaintError.
 */
function mapSupportChatError(message: string): ApiError {
  return new ApiError('VALIDATION_ERROR', message || 'We could not send your message. Please try again.', 422)
}

export async function handleSupportChatStart(
  body: SupportChatStartRequestBody,
  supabase: SupabaseLike,
): Promise<SupportChatStartResult> {
  const fieldErrors: Record<string, string> = {}

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const hasImage = typeof body.imageBase64 === 'string' && body.imageBase64.length > 0

  if (!fullName) fieldErrors.fullName = 'Please enter your name.'
  if (!EMAIL_RE.test(email)) fieldErrors.email = 'Please enter a valid email address.'
  if (!message && !hasImage) fieldErrors.message = 'Please enter a message.'

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError('VALIDATION_ERROR', 'Please check the highlighted fields.', 422, fieldErrors)
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

  const { data, error } = await supabase.rpc('start_support_chat_public', {
    p_customer_full_name: fullName,
    p_customer_email: email,
    p_customer_phone: phone,
    p_message: message || null,
    p_image_path: imagePath,
  })

  if (error) throw mapSupportChatError(error.message)
  const row = data?.[0]
  if (!row) {
    throw new ApiError('SERVER_ERROR', 'Your message did not go through. Please try again.', 500)
  }

  return {
    complaintId: row.complaint_id as string,
    accessToken: row.access_token as string,
    status: row.status as string,
  }
}
