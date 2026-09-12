import { useEffect } from 'react'

const SITE_NAME = 'Bliss Rent'

// Bliss Rent's real, live production domain (bliss-rent-uae.vercel.app,
// git-linked to GhazanfarGw/Bliss-Rent---UAE — see
// claude/phase-14-deployment-status-2026-09-08.md). This local repo
// (dubai-airport-rental-preview) isn't itself what's currently deployed
// there, but this is the one real domain that exists for the business,
// so canonical URLs and the sitemap are built from it rather than a
// guessed placeholder. If the production domain ever changes, update
// this constant, index.html's canonical/og:url tags, and
// scripts/generate-sitemap.mjs's own copy of the same value together.
export const SITE_URL = 'https://bliss-rent-uae.vercel.app'

// Kept in sync with index.html's <meta name="description">  — the
// fallback used whenever a page doesn't (or can't yet) provide its own
// real description, so a page that omits one never inherits a stale
// description left behind by whichever page the visitor was on before.
const DEFAULT_DESCRIPTION =
  'Book premium and economy car rentals in Dubai with fast airport delivery, flexible pickup and return points across the UAE, and no hidden fees. Reserve online in minutes — no account needed.'

/**
 * Sets the browser tab/history title for the current page. Before this,
 * every route showed the same static `index.html` title ("Bliss Rent —
 * Dubai Airport Car Rental") — real gap for bookmarking, browser history,
 * and shared links, since every open tab and every past visit looked
 * identical. Each call site passes real, already-translated copy already
 * shown on that page (a SectionHeader/PageHero title, or real vehicle
 * make/model) — nothing invented here.
 *
 * No cleanup/restore on unmount: the next page mounted by the router sets
 * its own title immediately, so there's nothing to restore to.
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Dubai Airport Car Rental`
  }, [title])
}

function upsertMetaByName(name: string, content: string) {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', name)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function upsertCanonicalLink(href: string) {
  let tag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!tag) {
    tag = document.createElement('link')
    tag.setAttribute('rel', 'canonical')
    document.head.appendChild(tag)
  }
  tag.setAttribute('href', href)
}

/**
 * Sets the per-page `<meta name="description">` and `<link
 * rel="canonical">` for the current route. Before this, every route on
 * this SPA shared index.html's one static description and had no
 * canonical tag at all — search engines had no way to tell an About page
 * apart from a vehicle detail page in a results snippet, or to know which
 * URL is the "real" one for a given piece of content.
 *
 * Each call site passes real, already-shown page copy (the same
 * subtitle/intro text already rendered on that page) rather than new
 * marketing claims — same rule `useDocumentTitle` already follows for
 * titles. Falls back to the sitewide default description (matching
 * index.html) when a page doesn't pass one, e.g. while a vehicle is still
 * loading, so a page never keeps showing the previous page's description.
 *
 * Canonical is derived from `window.location.pathname` (no query string —
 * e.g. /search?category=Luxury and /search both canonicalize to /search,
 * which is correct: they're the same page, just filtered) joined to
 * `SITE_URL`. No cleanup/restore on unmount, same reasoning as
 * `useDocumentTitle`: the next page mounted sets its own values.
 */
export function useMetaDescription(description?: string | null) {
  useEffect(() => {
    upsertMetaByName('description', description || DEFAULT_DESCRIPTION)
    upsertCanonicalLink(`${SITE_URL}${window.location.pathname}`)
  }, [description])
}

/**
 * Marks the current page `noindex, follow` — used only by the `*`
 * catch-all 404 route. A URL that resolves to "page not found" should
 * never be indexed or shown in search results; `follow` still lets
 * crawlers use any real links on the page (NotFoundPage links back to
 * Home and Search) instead of treating it as a dead end.
 *
 * Unlike useDocumentTitle/useMetaDescription, this DOES clean up on
 * unmount: `noindex` is the one signal here that must never survive past
 * the page that set it. Every other route relies on client-side
 * navigation simply overwriting the previous page's title/description —
 * but nothing else ever calls upsertMetaByName('robots', ...), so a real
 * page navigated to *from* the 404 page would otherwise keep inheriting
 * the noindex tag with no page left to overwrite it (confirmed live: a
 * SPA link click from /some-bad-url to / left the freshly-loaded
 * homepage marked noindex until this cleanup was added).
 */
export function useNoIndex() {
  useEffect(() => {
    upsertMetaByName('robots', 'noindex, follow')
    return () => {
      document.querySelector('meta[name="robots"]')?.remove()
    }
  }, [])
}
