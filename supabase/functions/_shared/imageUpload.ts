// Shared by support-chat-start and support-chat-message — both accept the
// Support Chat widget's optional photo the same way (a base64 string plus
// its MIME type, read client-side via FileReader before the request is
// sent) and must validate/decode it identically, so that logic lives here
// once instead of twice.
import { ApiError } from './errors.ts'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB — matches the client-side cap in SupportChatWidget.tsx.

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export interface DecodedImage {
  bytes: Uint8Array
  contentType: string
  /** A flat, random object key for the private complaint-attachments bucket — no per-complaint folder, since nothing ever lists or path-scopes this bucket client-side (admin reads go through a signed URL by exact path, not a folder listing). */
  path: string
}

/**
 * Decodes and validates a data-URI-free base64 image payload. Throws a
 * guest-safe ApiError (never a raw decode exception) for anything that
 * isn't one of the allowed image types or is over the size cap — the
 * same "validate before touching the database/storage" posture as every
 * other guest-facing Edge Function in this repo.
 */
export function decodeImageUpload(base64: string, mimeType: string): DecodedImage {
  const extension = EXTENSION_BY_MIME_TYPE[mimeType]
  if (!extension) {
    throw new ApiError('VALIDATION_ERROR', 'Please attach a JPG, PNG, or WEBP image.', 422, {
      image: 'Please attach a JPG, PNG, or WEBP image.',
    })
  }

  let bytes: Uint8Array
  try {
    const binary = atob(base64)
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    throw new ApiError('VALIDATION_ERROR', 'That image could not be read. Please try a different file.', 422, {
      image: 'That image could not be read. Please try a different file.',
    })
  }

  if (bytes.byteLength === 0) {
    throw new ApiError('VALIDATION_ERROR', 'That image could not be read. Please try a different file.', 422, {
      image: 'That image could not be read. Please try a different file.',
    })
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ApiError('VALIDATION_ERROR', 'That image is too large — please attach one under 5 MB.', 422, {
      image: 'That image is too large — please attach one under 5 MB.',
    })
  }

  return { bytes, contentType: mimeType, path: `${crypto.randomUUID()}.${extension}` }
}
