import heroEconomy from '@/assets/hero/hero-economy.webp'
import heroSedan from '@/assets/hero/hero-sedan.webp'
import heroSuv from '@/assets/hero/hero-suv.webp'
import heroLuxury from '@/assets/hero/hero-luxury.webp'
import heroBlissJourney from '@/assets/hero/hero-bliss-journey.webp'

/**
 * The hero's image source list — real, photorealistic vehicle photography
 * (Phase 4.1), one image per fleet category, replacing the Phase 4
 * placeholder SVGs. Every image is composed with the vehicle on the right
 * two-thirds of the frame and clean negative space on the left, so the
 * headline/CTA (rendered at the inline-start side — see Hero.tsx) stays
 * readable over the image in both LTR and RTL.
 *
 * Copy (title/body) is NOT duplicated here — it stays in the i18n
 * `hero.slides` array (en.ts/ar.ts) exactly as it already existed, so this
 * file only adds the image (and alt text key) each translated slide pairs
 * with, by index. Since the Phase 11 redesign, Hero.tsx renders only one
 * pinned index instead of rotating through all five (see HERO_SLIDE_INDEX
 * in Hero.tsx); this list itself is unchanged.
 */
export interface HeroSlideImage {
  src: string
  /** i18n key resolving to a meaningful, translated alt description. */
  altKey: string
}

export const HERO_SLIDE_IMAGES: HeroSlideImage[] = [
  { src: heroEconomy, altKey: 'hero.slideAlt.economy' },
  { src: heroSedan, altKey: 'hero.slideAlt.sedan' },
  { src: heroSuv, altKey: 'hero.slideAlt.suv' },
  { src: heroLuxury, altKey: 'hero.slideAlt.luxury' },
  { src: heroBlissJourney, altKey: 'hero.slideAlt.premium' },
]

/**
 * The pinned hero background (HERO_SLIDE_INDEX in Hero.tsx) is now a video
 * instead of a static photo. It's served from /public/hero rather than
 * imported as a module asset — a video is large enough that bundling it
 * would bloat the JS build, and unlike the imported .webp slides above it
 * doesn't need Vite to fingerprint/optimize it.
 *
 * Desktop and mobile intentionally use DIFFERENT clips (owner's request —
 * the wide desktop shot doesn't crop well to a tall phone screen), picked
 * via each `<source>`'s `media` attribute in Hero.tsx (evaluated once at
 * load, not reactive to a later resize — fine for a hero background) at
 * the same `min-width: 1024px` breakpoint Hero.tsx's own `lg:` layout
 * classes already use, so the two switch together.
 *
 * Drop the actual file(s) in public/hero/ using these exact names:
 *   - hero-video.mp4          (desktop, required — H.264, ideally <8MB)
 *   - hero-video.webm         (desktop, optional smaller fallback)
 *   - hero-video-mobile.mp4   (mobile, required — H.264, ideally <8MB)
 *   - hero-video-mobile.webm  (mobile, optional smaller fallback)
 *
 * HERO_SLIDE_IMAGES[HERO_SLIDE_INDEX] (heroBlissJourney) is still used as
 * the <video>'s poster (same still for both breakpoints) and as the image
 * shown for prefers-reduced-motion, so nothing breaks before either video
 * file exists — it just won't play yet.
 */
export const HERO_VIDEO_SOURCES = {
  desktop: {
    webm: '/hero/hero-video.webm',
    mp4: '/hero/hero-video.mp4',
  },
  mobile: {
    webm: '/hero/hero-video-mobile.webm',
    mp4: '/hero/hero-video-mobile.mp4',
  },
}

/** Matches Hero.tsx's own `lg:` breakpoint — the video source list above
 *  switches at the same width its layout does. */
export const HERO_VIDEO_DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'
