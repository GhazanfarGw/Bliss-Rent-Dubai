import { supabase } from '@/lib/supabaseClient'
import { readCookieConsent } from '@/lib/cookieConsent'

/**
 * Marketing attribution + ad/analytics tags (Oct 2026 lead-gen sprint).
 *
 * - Attribution (UTM params, referrer, landing page) is captured on every
 *   visit into localStorage — first-party, no third party involved — and
 *   written to the booking via the `set_booking_attribution` RPC right
 *   after create-booking succeeds.
 * - GA4, Google Ads and Meta Pixel load ONLY after the visitor accepts the
 *   cookie banner. Each tag is skipped when its VITE_* id is unset, so the
 *   site behaves exactly as before until ids are added in Vercel.
 * - WhatsApp / phone clicks are tracked with one delegated listener, so the
 *   21 existing wa.me links need no changes.
 */

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown }
    _fbq?: unknown
  }
}

const GA4_ID = import.meta.env.VITE_GA4_ID
const GADS_ID = import.meta.env.VITE_GADS_ID
const GADS_LABEL_WHATSAPP = import.meta.env.VITE_GADS_LABEL_WHATSAPP
const GADS_LABEL_BOOKING = import.meta.env.VITE_GADS_LABEL_BOOKING
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID
const GTM_ID = import.meta.env.VITE_GTM_ID

const ATTRIBUTION_KEY = 'bliss-attribution'
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

export type Attribution = Partial<Record<(typeof UTM_KEYS)[number], string>> & {
  referrer?: string
  landing_page?: string
  captured_at: number
}

let trackersLoaded = false

/** Call once at boot. A visit carrying UTM params replaces older attribution (last paid touch wins); otherwise the stored one is kept for 30 days. */
export function captureAttribution(): void {
  try {
    const params = new URLSearchParams(window.location.search)
    const fromUrl: Attribution = { captured_at: Date.now() }
    let hasUtm = false
    for (const key of UTM_KEYS) {
      const value = params.get(key)
      if (value) {
        fromUrl[key] = value.slice(0, 150)
        hasUtm = true
      }
    }
    const existing = readAttribution()
    if (!hasUtm && existing) return
    const externalReferrer =
      document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer.slice(0, 500) : undefined
    if (!hasUtm && !externalReferrer) return
    fromUrl.referrer = externalReferrer
    fromUrl.landing_page = (window.location.pathname + window.location.search).slice(0, 500)
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(fromUrl))
  } catch {
    // storage unavailable — attribution is best-effort
  }
}

export function readAttribution(): Attribution | null {
  try {
    const raw = localStorage.getItem(ATTRIBUTION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Attribution
    if (!parsed.captured_at || Date.now() - parsed.captured_at > ATTRIBUTION_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

/** Best-effort: never blocks or fails checkout. */
export async function attachBookingAttribution(bookingId: string): Promise<void> {
  const a = readAttribution()
  if (!a) return
  try {
    await supabase.rpc('set_booking_attribution', {
      p_booking_id: bookingId,
      p_utm_source: a.utm_source ?? null,
      p_utm_medium: a.utm_medium ?? null,
      p_utm_campaign: a.utm_campaign ?? null,
      p_utm_content: a.utm_content ?? null,
      p_utm_term: a.utm_term ?? null,
      p_referrer: a.referrer ?? null,
      p_landing_page: a.landing_page ?? null,
    })
  } catch {
    // ignore
  }
}

function injectScript(src: string): void {
  const s = document.createElement('script')
  s.async = true
  s.src = src
  document.head.appendChild(s)
}

/** Loads tags only if consent is 'accepted'. Safe to call repeatedly. */
export function loadTrackersIfConsented(): void {
  if (trackersLoaded || readCookieConsent() !== 'accepted') return
  if (window.location.pathname.startsWith('/admin')) return
  trackersLoaded = true

  const gtagId = GA4_ID || GADS_ID
  if (gtagId) {
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments)
    }
    window.gtag('js', new Date())
    // SPA: page_view is sent manually from trackPageView on route change.
    if (GA4_ID) window.gtag('config', GA4_ID, { send_page_view: false })
    if (GADS_ID) window.gtag('config', GADS_ID)
    injectScript(`https://www.googletagmanager.com/gtag/js?id=${gtagId}`)
  }

  // Google Tag Manager — for extra marketing tags managed in the GTM UI.
  // GA4, Google Ads and Meta Pixel are loaded directly above/below, so do NOT
  // also add them inside the GTM container (that would double-count).
  if (GTM_ID) {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    injectScript(`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`)
  }

  if (META_PIXEL_ID && !window.fbq) {
    const fbq = function (...args: unknown[]) {
      const f = fbq as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] }
      if (f.callMethod) f.callMethod(...args)
      else f.queue.push(args)
    } as NonNullable<Window['fbq']>
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = '2.0'
    fbq.queue = []
    window.fbq = fbq
    window._fbq = fbq
    injectScript('https://connect.facebook.net/en_US/fbevents.js')
    window.fbq('init', META_PIXEL_ID)
  }

  trackPageView(window.location.pathname + window.location.search)
}

export function trackPageView(path: string): void {
  if (!trackersLoaded || path.startsWith('/admin')) return
  if (GA4_ID) window.gtag?.('event', 'page_view', { page_path: path, page_location: window.location.href, page_title: document.title })
  window.fbq?.('track', 'PageView')
}

function adsConversion(label: string | undefined, params: Record<string, unknown> = {}): void {
  if (GADS_ID && label) window.gtag?.('event', 'conversion', { send_to: `${GADS_ID}/${label}`, ...params })
}

export function trackWhatsAppClick(placement: string): void {
  if (!trackersLoaded) return
  window.dataLayer?.push({ event: 'whatsapp_click', placement })
  window.gtag?.('event', 'generate_lead', { method: 'whatsapp', placement })
  window.fbq?.('track', 'Contact', { content_category: 'whatsapp', placement })
  adsConversion(GADS_LABEL_WHATSAPP)
}

export function trackBookingCreated(p: { bookingId: string; value: number; currency: string; vehicle: string }): void {
  if (!trackersLoaded) return
  window.dataLayer?.push({ event: 'booking_created', booking_id: p.bookingId, value: p.value, currency: p.currency })
  window.gtag?.('event', 'booking_created', { transaction_id: p.bookingId, value: p.value, currency: p.currency, vehicle: p.vehicle })
  window.fbq?.('track', 'Lead', { value: p.value, currency: p.currency, content_name: p.vehicle }, { eventID: p.bookingId })
  adsConversion(GADS_LABEL_BOOKING, { value: p.value, currency: p.currency, transaction_id: p.bookingId })
}

/** One delegated listener for every wa.me / tel: link in the app. */
export function installContactClickTracking(): void {
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as Element | null
      const a = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      if (href.startsWith('https://wa.me/') || href.includes('api.whatsapp.com')) {
        trackWhatsAppClick(window.location.pathname)
      } else if (href.startsWith('tel:') && trackersLoaded) {
        window.gtag?.('event', 'generate_lead', { method: 'phone', placement: window.location.pathname })
        window.fbq?.('track', 'Contact', { content_category: 'phone' })
      }
    },
    { capture: true },
  )
}
