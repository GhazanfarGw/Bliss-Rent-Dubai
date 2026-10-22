// "Get a quote" form — pure request handler for the submit-quote-request
// Edge Function (same logic.ts / index.ts split as every other function
// here, so it is unit-testable without Deno).
//
// Validates + normalises the guest payload, silently accepts honeypot
// hits (bots get a fake success and nothing is stored), then inserts via
// submit_quote_request_public() — which enforces the real, server-side
// rate limits. See 20261023000000_quote_request_public.sql.
import { ApiError } from '../_shared/errors.ts'

export interface SubmitQuoteRequestBody {
  fullName?: string
  phone?: string
  email?: string
  carInterest?: string
  vehicleId?: string
  pickupLocationId?: string
  startDate?: string
  endDate?: string
  notes?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  /** Honeypot: hidden input real visitors never fill. */
  website?: string
}

export interface SubmitQuoteResult {
  leadId: string | null
  /** True when the honeypot tripped — nothing was stored or emailed. */
  discarded: boolean
}

export interface SupabaseLike {
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string; message: string } | null }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^\S+@\S+\.\S+$/

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/**
 * Normalise a phone number to E.164. Defaults to the UAE (+971) because
 * the form is for Dubai rentals: "050 123 4567" → "+971501234567",
 * "00971 50…" → "+97150…", "+44 7700 900123" stays as entered.
 * Returns null when the result is not a plausible international number.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  let digits = trimmed.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) digits = '+' + digits.slice(2)
  if (!digits.startsWith('+')) {
    const local = digits.replace(/\D/g, '')
    if (local.startsWith('971')) digits = '+' + local
    else if (local.startsWith('0')) digits = '+971' + local.slice(1)
    else if (/^5\d{8}$/.test(local)) digits = '+971' + local
    else digits = '+' + local
  }
  digits = '+' + digits.slice(1).replace(/\D/g, '')
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null
}

export async function handleSubmitQuoteRequest(body: SubmitQuoteRequestBody, supabase: SupabaseLike): Promise<SubmitQuoteResult> {
  if (str(body.website, 200)) {
    return { leadId: null, discarded: true }
  }

  const fieldErrors: Record<string, string> = {}
  const fullName = str(body.fullName, 80)
  const phone = normalizePhone(str(body.phone, 30))
  const email = str(body.email, 120)
  const vehicleId = str(body.vehicleId, 36)
  const pickupLocationId = str(body.pickupLocationId, 36)
  const startDate = str(body.startDate, 10)
  const endDate = str(body.endDate, 10)

  if (fullName.length < 2) fieldErrors.fullName = 'Please enter your name.'
  if (!phone) fieldErrors.phone = 'Please enter a valid phone or WhatsApp number.'
  if (email && !EMAIL_RE.test(email)) fieldErrors.email = 'Please enter a valid email address.'
  if (startDate && !DATE_RE.test(startDate)) fieldErrors.startDate = 'Please choose a valid pickup date.'
  if (endDate && !DATE_RE.test(endDate)) fieldErrors.endDate = 'Please choose a valid return date.'
  if (startDate && endDate && DATE_RE.test(startDate) && DATE_RE.test(endDate) && endDate < startDate) {
    fieldErrors.endDate = 'Return date must be after the pickup date.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ApiError('VALIDATION_ERROR', 'Please check the highlighted fields.', 422, fieldErrors)
  }

  const { data, error } = await supabase.rpc('submit_quote_request_public', {
    p_full_name: fullName,
    p_phone: phone,
    p_email: email || null,
    p_car_interest: str(body.carInterest, 120) || null,
    p_vehicle_id: UUID_RE.test(vehicleId) ? vehicleId : null,
    p_pickup_location_id: UUID_RE.test(pickupLocationId) ? pickupLocationId : null,
    p_start_date: startDate || null,
    p_end_date: endDate || null,
    p_notes: str(body.notes, 1000) || null,
    p_utm_source: str(body.utmSource, 100) || null,
    p_utm_medium: str(body.utmMedium, 100) || null,
    p_utm_campaign: str(body.utmCampaign, 150) || null,
  })

  if (error) {
    // The SQL function only raises guest-safe messages (validation / rate limit).
    throw new ApiError('VALIDATION_ERROR', error.message || 'We could not send your request. Please try again.', 422)
  }
  if (typeof data !== 'string') {
    throw new ApiError('SERVER_ERROR', 'Your request did not go through. Please try again.', 500)
  }
  return { leadId: data, discarded: false }
}
