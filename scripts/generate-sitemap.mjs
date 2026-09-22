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
// where this domain comes from.
const SITE_URL = 'https://bliss.rent'

try {
  process.loadEnvFile(resolve(__dirname, '../.env'))
} catch {
  // No .env in this environment — static routes only, below.
}

/**
 * Static marketing/content routes worth indexing. Deliberately excludes:
 *  - transactional/utility pages (/manage-booking, /extend-rental and
 *    /find-my-car — both redirect to /manage-booking, every
 *    /checkout/* step) — access-gated or single-purpose lookup tools,
 *    not content search should rank;
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
  // One page per emirate's main city — keep in sync with CITY_GUIDES in
  // src/features/content/cityGuides.ts (a unit test checks they match).
  { path: '/locations/dubai', changefreq: 'monthly', priority: '0.6' },
  { path: '/locations/abu-dhabi', changefreq: 'monthly', priority: '0.6' },
  { path: '/locations/sharjah', changefreq: 'monthly', priority: '0.6' },
  { path: '/locations/ajman', changefreq: 'monthly', priority: '0.6' },
  { path: '/locations/umm-al-quwain', changefreq: 'monthly', priority: '0.6' },
  { path: '/locations/ras-al-khaimah', changefreq: 'monthly', priority: '0.6' },
  { path: '/locations/fujairah', changefreq: 'monthly', priority: '0.6' },
  { path: '/locations/al-ain', changefreq: 'monthly', priority: '0.6' },
  // The blog — keep in sync with BLOG_POSTS / BLOG_CATEGORIES in
  // src/features/blog/blogPosts.ts (a unit test checks they match, including
  // each article's lastmod = its updatedAt, or publishedAt if never updated).
  { path: '/blog', changefreq: 'weekly', priority: '0.7' },
  { path: '/blog/category/rental-guides', changefreq: 'weekly', priority: '0.5' },
  { path: '/blog/category/city-guides', changefreq: 'weekly', priority: '0.5' },
  { path: '/blog/category/road-trips', changefreq: 'weekly', priority: '0.5' },
  { path: '/blog/category/travel-tips', changefreq: 'weekly', priority: '0.5' },
  { path: '/blog/car-rental-dubai-complete-guide', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/dubai-airport-car-rental', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/documents-needed-to-rent-a-car-uae', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/how-to-book-a-rental-car-online-uae', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/economy-sedan-suv-or-luxury-rental-car', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/monthly-and-weekly-car-rental-uae', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/dubai-in-three-days-by-car', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/abu-dhabi-weekend-by-car', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/sharjah-and-ajman-by-car', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/umm-al-quwain-by-car', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/dubai-to-abu-dhabi-road-trip', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/dubai-to-hatta-road-trip', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/ras-al-khaimah-jebel-jais-road-trip', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/fujairah-east-coast-road-trip', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/al-ain-day-trip-by-car', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/salik-parking-and-fines-uae-rental-car', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
  { path: '/blog/driving-in-the-uae-first-timers-checklist', changefreq: 'monthly', priority: '0.6', lastmod: '2026-09-19' },
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
