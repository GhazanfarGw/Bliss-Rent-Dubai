import heroEconomy from '@/assets/hero/hero-economy.webp'
import heroSedan from '@/assets/hero/hero-sedan.webp'
import heroSuv from '@/assets/hero/hero-suv.webp'
import heroLuxury from '@/assets/hero/hero-luxury.webp'
import heroBlissJourney from '@/assets/hero/hero-bliss-journey.webp'
import heroVideoDesktopMp4 from '@/assets/hero/hero-video.mp4'
import heroVideoMobileMp4 from '@/assets/hero/hero-video-mobile.mp4'

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
 * instead of a static photo. The .mp4 files are imported as real module
 * assets (src/assets/hero/) exactly like the .webp slides above, NOT
 * served as plain strings from /public/hero — that earlier approach
 * (avoiding "bloating the JS build") was based on a mistaken worry: an
 * imported video isn't inlined into JS either way, it's just copied to
 * the build output as its own file. What that earlier approach actually
 * cost was cache-busting: /public files keep the exact same URL forever,
 * so replacing hero-video.mp4's content (as happened) left visitors'
 * browsers serving the OLD cached clip indefinitely — a stale hero video
 * on refresh, with no way to force an update short of a hard-refresh.
 * Importing it lets Vite fingerprint the filename by content hash, so a
 * changed video automatically gets a new URL and busts every cache.
 *
 * Desktop and mobile intentionally use DIFFERENT clips (owner's request —
 * the wide desktop shot doesn't crop well to a tall phone screen), picked
 * via each `<source>`'s `media` attribute in Hero.tsx (evaluated once at
 * load, not reactive to a later resize — fine for a hero background) at
 * the same `min-width: 1024px` breakpoint Hero.tsx's own `lg:` layout
 * classes already use, so the two switch together.
 *
 * The .webm fallbacks are the one piece still NOT wired to a real file
 * (none has been supplied) — left as plain /public/hero paths since
 * there's nothing to import yet; harmless 404s today (the browser just
 * skips to the next <source>), swap to a real import the same way the
 * .mp4s above are done if a compressed .webm pair is ever added.
 *
 * HERO_SLIDE_IMAGES[HERO_SLIDE_INDEX] (heroBlissJourney) is still used as
 * the <video>'s poster (same still for both breakpoints) and as the image
 * shown for prefers-reduced-motion.
 */
export const HERO_VIDEO_SOURCES = {
  desktop: {
    webm: '/hero/hero-video.webm',
    mp4: heroVideoDesktopMp4,
  },
  mobile: {
    webm: '/hero/hero-video-mobile.webm',
    mp4: heroVideoMobileMp4,
  },
}

/** Matches Hero.tsx's own `lg:` breakpoint — the video source list above
 *  switches at the same width its layout does. */
export const HERO_VIDEO_DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'
