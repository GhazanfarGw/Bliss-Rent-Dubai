# Hero image assets

Real, photorealistic hero photography (Phase 4.1), one image per fleet
category, replacing the Phase 4 placeholder SVGs. Each was generated with
Google Gemini, downloaded, and converted to WebP; one (`hero-economy.webp`)
had a visible third-party vehicle-brand badge on the grille removed via a
local, seamless clone-and-blend edit before export (no other files were
touched) so no third-party logo appears on any file in this folder — the
project's own rules forbid baking any brand logo, including Bliss Rent's
own, into these images.

## Current files

| File | Used for (see `src/features/booking/heroSlides.ts`) | Alt text key |
|---|---|---|
| `hero-economy.webp` | Slide 1 — "A fleet for every budget" | `hero.slideAlt.economy` |
| `hero-sedan.webp` | Slide 2 — "Airport pickup, city-wide drop-off" | `hero.slideAlt.sedan` |
| `hero-suv.webp` | Slide 3 — "Book online in minutes" | `hero.slideAlt.suv` |
| `hero-luxury.webp` | Slide 4 — "Premium comfort, every time" | `hero.slideAlt.luxury` |
| `hero-premium.webp` | Slide 5 — "Drive Dubai in style" | `hero.slideAlt.premium` |

All five are 1376×768 (16:9), WebP, 20–55 KB each. Each was composed with the
vehicle on the right two-thirds of the frame and clean negative space on the
left, so the headline/CTA (rendered at the inline-start side) stays readable
over the image — `HeroCarousel.tsx` layers a dark-to-transparent gradient on
top for guaranteed contrast in both LTR and RTL regardless of the underlying
photo.

## Replacing a slide's image later

1. Save the new image into this folder (`.webp`/`.jpg`/`.png` all work with
   Vite's default asset handling).
2. Update the matching entry's `src` (and `altKey`, if the description
   changes) in `src/features/booking/heroSlides.ts`. Nothing in
   `HeroCarousel.tsx` needs to change — it only ever renders whatever
   `heroSlides.ts` gives it.
3. Delete the file it replaces once the swap is confirmed working.

## Image guidelines

- Landscape, 16:9, high resolution — fills the full-width hero without heavy
  cropping on desktop or mobile.
- Keep the left two-thirds (where the headline and CTA sit) relatively
  uncluttered so text stays legible over the image.
- No people, no text/watermarks baked into the image, and no visible
  brand/manufacturer logos or badges (including Bliss Rent's own).
- Export as `.webp` for a small file size.
