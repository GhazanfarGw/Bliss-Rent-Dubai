// Generates public/sitemap.xml from the site's real routes plus the
// live, publicly-bookable fleet — never a hand-maintained, drift-prone
// list. Run standalone (`npm run sitemap`) or automatically as the first
// step of `npm run build`, so a deploy always ships a sitemap that
// matches the fleet at build time.
//
// Vehicle detail pages (/vehicles/:id) are fetched straight from
// Supabase with the exact same filter VehicleDetailPage/api.ts already
// use for a real, currently-bookable listing (`status = 'available'`,
// `is_master_listing = true`) — a Reserved copy or a retired/hidden
// vehicle is never listed here, same as it's never reachable on the
// public site. If Supabase credentials aren't available (e.g. a CI
// context without .env), the script still writes a sitemap with just the
// static marketing/content routes rather than failing the build.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(__dirname, '../public/sitemap.xml')

// Kept in sync with src/lib/useDocumentTitle.ts's own SITE_URL constant
// and index.html's canonical/og:url tags — see that file's comment for
// why this is the real production domain even though this local repo
// isn't (yet) what's deployed there.
const SITE_URL = 'https://bliss-rent-uae.vercel.app'

try {
  process.loadEnvFile(resolve(__dirname, '../.env'))
} catch {
  // No .env in this environment — static routes only, below.
}

/**
 * Static marketing/content routes worth indexing. Deliberately excludes:
 *  - transactional/utility pages (/find-my-car, /manage-booking,
 *    /extend-rental, every /checkout/* step) — access-gated or
 *    single-purpose lookup tools, not content search should rank;
 *  - /search — a filterable results view, not a distinct piece of
 *    content (its query-string variants would otherwise all canonicalize
 *    to the same URL anyway, per useMetaDescription's canonical logic);
 *  - everything under /admin — already Disallow'd in robots.txt.
 */
const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/book', changefreq: 'weekly', priority: '0.8' },
  { path: '/about', changefreq: 'monthly', priority: '0.6' },
  { path: '/car-types', changefreq: 'monthly', priority: '0.6' },
  { path: '/locations', changefreq: 'weekly', priority: '0.7' },
  { path: '/faqs', changefreq: 'monthly', priority: '0.5' },
  { path: '/contact', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy-policy', changefreq: 'yearly', priority: '0.2' },
  { path: '/cookie-policy', changefreq: 'yearly', priority: '0.2' },
  { path: '/booking-terms', changefreq: 'yearly', priority: '0.2' },
]

async function fetchLiveVehicleRoutes() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[generate-sitemap] VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY not set — skipping /vehicles/:id entries.')
    return []
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, created_at')
    .eq('status', 'available')
    .eq('is_master_listing', true)

  if (error) {
    console.warn(`[generate-sitemap] Could not fetch live vehicles (${error.message}) — skipping /vehicles/:id entries.`)
    return []
  }

  return (data ?? []).map((vehicle) => ({
    path: `/vehicles/${vehicle.id}`,
    changefreq: 'weekly',
    priority: '0.7',
    lastmod: vehicle.created_at ? vehicle.created_at.slice(0, 10) : undefined,
  }))
}

function buildXml(routes) {
  const urlEntries = routes
    .map((route) => {
      const lastmodTag = route.lastmod ? `\n    <lastmod>${route.lastmod}</lastmod>` : ''
      return `  <url>
    <loc>${SITE_URL}${route.path}</loc>${lastmodTag}
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`
}

const vehicleRoutes = await fetchLiveVehicleRoutes()
const allRoutes = [...STATIC_ROUTES, ...vehicleRoutes]
writeFileSync(OUTPUT_PATH, buildXml(allRoutes), 'utf-8')
console.log(`[generate-sitemap] Wrote ${allRoutes.length} URLs (${STATIC_ROUTES.length} static + ${vehicleRoutes.length} live vehicles) to public/sitemap.xml`)
