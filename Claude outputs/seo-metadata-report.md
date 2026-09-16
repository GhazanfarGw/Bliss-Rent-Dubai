# SEO & Metadata Update — Bliss Rent (bliss.rent)

**Date completed:** Sept 12–13, 2026
**Status:** Committed to local `master` branch — pending push to GitHub (device currently has no GitHub access; will be pushed once available)

## What changed

### 1. Sitemap generation
- New script (`scripts/generate-sitemap.mjs`) automatically builds `sitemap.xml` on every production build (also runnable standalone).
- The sitemap is generated live from the database: it includes every real static page plus every vehicle that is actually publicly bookable right now (available, not a reserved/duplicate listing) — the same filter the live site itself uses, so nothing appears in the sitemap that a visitor couldn't actually book.
- Booking/checkout utility pages (Find My Car, Manage Booking, checkout steps) and the filterable Search page are deliberately left out, since they're not distinct content worth indexing.
- Current sitemap: 39 URLs (10 static pages + 29 live vehicles).

### 2. Per-page metadata
- Previously the entire site shared a single meta description and had no canonical tag on any page — search engines had no way to tell pages apart or know which URL was the "real" one.
- Every route now has its own canonical link and its own meta description.
- `robots.txt` now correctly points search engines at the sitemap.

### 3. Domain correction
- The first pass of this work had used the old `bliss-rent-uae.vercel.app` address (from outdated documentation). That project has since been deleted on Vercel.
- Verified directly against the Vercel dashboard that the site's real, live production domain is **bliss.rent**.
- Corrected every reference — canonical tags, `og:url`, `robots.txt`, the sitemap generator, and the site's title/URL logic — to point at `bliss.rent` consistently, and regenerated the sitemap under the corrected domain.

## Why this matters for the team

- Search engines can now index individual pages properly (each with its own description and a canonical URL), instead of treating the whole site as one page.
- The sitemap stays accurate automatically going forward — it regenerates from real inventory on every build, so it won't drift out of date as vehicles are added or removed.
- All SEO-facing URLs now consistently point at the correct production domain, avoiding split signals between an old dead domain and the real one.

## Outstanding

- Not yet pushed to GitHub / not yet live in production — waiting on GitHub access from this device (or a push from another machine).
- Once live, worth submitting the new sitemap to Google Search Console / Bing Webmaster Tools to prompt re-crawling sooner.
