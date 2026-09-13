// support-chat-thread — pure, framework-free request handler. Same split
// rationale as every other function in this repo — see create-booking/logic.ts.
//
// Read-only: resolves a conversation by its access_token and returns its
// full message list, each photo resolved to a short-lived signed URL
// (the 'complaint-attachments' bucket is private, so a guest browser
// could never generate one of those itself). SupportChatWidget.tsx polls
// this while its panel is open and in "message our team" mode — this is
// also how an admin's reply, typed into ComplaintDetailPage, reaches the
// widget: no realtime channel, just a plain poll.
import { ApiError } from '../_shared/errors.ts'

export interface SupportChatThreadRequestBody {
  accessToken?: string
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

interface MessageRow {
  id: string
  sender: string
  body: string | null
  image_path: string | null
  created_at: string
}

export interface SupabaseLike {
  findComplaintByToken(token: string): Promise<{ id: string; status: string } | null>
  listMessages(complaintId: string): Promise<MessageRow[]>
  getSignedImageUrl(path: string): Promise<string | null>
}

export async function handleSupportChatThread(
  body: SupportChatThreadRequestBody,
  supabase: SupabaseLike,
): Promise<SupportChatThreadResult> {
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : ''
  if (!accessToken) {
    throw new ApiError('VALIDATION_ERROR', 'This conversation could not be found.', 422)
  }

  const complaint = await supabase.findComplaintByToken(accessToken)
  if (!complaint) {
    throw new ApiError('VALIDATION_ERROR', 'This conversation could not be found. Please start a new chat.', 404)
  }

  const rows = await supabase.listMessages(complaint.id)
  const messages: SupportChatThreadMessage[] = []
  for (const row of rows) {
    const imageUrl = row.image_path ? await supabase.getSignedImageUrl(row.image_path) : null
    messages.push({
      id: row.id,
      sender: row.sender === 'admin' ? 'admin' : 'customer',
      body: row.body,
      imageUrl,
      createdAt: row.created_at,
    })
  }

  return { complaintId: complaint.id, status: complaint.status, messages }
}
