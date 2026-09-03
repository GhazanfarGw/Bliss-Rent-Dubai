import heroEconomy from '@/assets/hero/hero-economy.webp'
import heroSedan from '@/assets/hero/hero-sedan.webp'
import heroSuv from '@/assets/hero/hero-suv.webp'
import heroLuxury from '@/assets/hero/hero-luxury.webp'
import heroPremium from '@/assets/hero/hero-premium.webp'

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
  { src: heroPremium, altKey: 'hero.slideAlt.premium' },
]
