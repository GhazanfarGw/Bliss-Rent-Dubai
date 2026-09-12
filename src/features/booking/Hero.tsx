import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HERO_SLIDE_IMAGES } from '@/features/booking/heroSlides'
import { Link } from 'react-router-dom'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { prefersReducedMotion } from '@/lib/motion'

interface Slide {
  title: string
  body: string
}

// The hero IMAGE stays pinned (Phase 11 decision, unchanged) — only the
// heading/body text auto-rotates through all 5 real slides below. Index 4
// ("Drive Dubai your way" / "A mix of premium and economy vehicles for
// city drives, short stays, and smooth arrivals.") is still where both
// the image and the text rotation start, so the very first paint matches
// what Phase 11 shipped.
const HERO_SLIDE_INDEX = 4
const HERO_TEXT_ROTATE_MS = 6000

/**
 * The homepage's main visual focus. Phase 11 pinned this to one static
 * image with no autoplay at all; per later feedback the heading/body text
 * should auto-change again (image and everything else stays as Phase 11
 * left it — no dots/arrows/slide counter, no image rotation, same layout,
 * same transparent-header treatment — see NavBar).
 *
 * Reuses the exact same real i18n copy (`hero.slides`, all 5 entries) the
 * original HeroCarousel rotated through — nothing new invented — just the
 * TEXT rotates on a plain interval now; HERO_SLIDE_IMAGES/HERO_SLIDE_INDEX
 * still pick a single fixed image, unchanged from Phase 11. Skips the
 * rotation entirely for prefers-reduced-motion, same as every other
 * autoplay/animation in this app (see src/lib/motion.ts).
 */
export function Hero() {
  const { t } = useTranslation()
  const slides = t('hero.slides', { returnObjects: true }) as Slide[]
  const [slideIndex, setSlideIndex] = useState(HERO_SLIDE_INDEX)
  const slide = slides[slideIndex] ?? slides[0]
  const image = HERO_SLIDE_IMAGES[HERO_SLIDE_INDEX] ?? HERO_SLIDE_IMAGES[0]

  useEffect(() => {
    if (prefersReducedMotion()) return
    const slideCount = slides.length
    if (slideCount <= 1) return
    const id = setInterval(() => {
      setSlideIndex((current) => (current + 1) % slideCount)
    }, HERO_TEXT_ROTATE_MS)
    return () => clearInterval(id)
  }, [slides.length])

  return (
    <section
      // Deliberate full-bleed exception to Layout's global `pt-[var(--header-h)]`:
      // the hero is meant to sit immersively under the translucent header, so
      // it negates that padding here rather than every other page doing so.
      id="home-hero"
      className="relative isolate -mt-[var(--header-h)] overflow-hidden bg-brand-navy"
    >
      <img
        src={image.src}
        alt={t(image.altKey)}
        loading="eager"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover object-center saturate-[1.1] contrast-[1.05]"
      />
      {/* The image itself stays bright and clearly visible — only a soft
          bottom-up gradient for the headline/CTA to sit on, plus a light
          band behind the transparent header so its text stays legible.
          No flat dark wash over the whole photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#05070d]/85 via-[#05070d]/25 via-45% to-transparent" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#05070d]/55 to-transparent" />

      {/* pt-[calc(var(--header-h)+var(--ticker-h))] guarantees the badge/
          heading always clear BOTH the fixed header and the TickerBar
          pinned directly beneath it (Phase 11) — the TickerBar itself is a
          separate fixed layer rendered by HomePage, not a child of this
          hero, so it isn't affected by this padding. Height increased
          (owner's request, referencing airline-style full hero sections)
          so the hero image reads as a real full-bleed visual, not a strip. */}
      <div className="relative z-10 mx-auto flex min-h-[600px] max-w-7xl items-end px-4 pb-12 pt-[calc(var(--header-h)+var(--ticker-h))] sm:px-6 lg:min-h-[100vh] lg:pb-16 lg:px-8">
        <div className="max-w-xl pb-20 md:pb-28 lg:pb-28">
          <div className="mb-5 inline-flex items-center gap-2 border border-[#fff]/35 bg-[#120f0a]/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.33em] text-[#fff] backdrop-blur-md shadow-[0_12px_28px_rgba(17,13,8,0.32)]">
            <span className="h-2 w-2 bg-brand-gold" />
            {t('hero.badge')}
          </div>

          {/* key={slideIndex} remounts this block on every rotation so the
              fade-in plays each time; skipped for prefers-reduced-motion
              by simply not applying the animation class (content still
              updates instantly, just without the transition). */}
          <div key={slideIndex} className={prefersReducedMotion() ? undefined : 'animate-hero-slide-fade'}>
            <h1 className="max-w-[12ch] text-4xl font-black leading-[0.84] tracking-[-0.08em] text-white drop-shadow-[0_16px_28px_rgba(0,0,0,0.3)] sm:text-5xl lg:text-[5.4rem]">
              <span className="block text-white">{slide.title}</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-white/80 sm:text-lg">{slide.body}</p>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {/* Direct navigation, not an on-page scroll: "Book Now" opens the
                dedicated Book a Car page and "View fleet" opens the full
                fleet listing, matching the header's own CTA/Fleet routes. */}
            <LinkButton
              to="/book"
              variant="primary"
              className="min-h-12 border border-brand-gold bg-brand-gold text-white shadow-none hover:brightness-105"
            >
              {t('hero.cta')}
            </LinkButton>
            <Link
              to="/search"
              className="inline-flex min-h-12 items-center justify-center border border-white/70 bg-white px-5 py-3 text-sm font-semibold text-brand-navy transition-all hover:bg-brand-lavender"
            >
              {t('hero.viewFleetCta')}
            </Link>
          </div>
          {/* No trust-badge row here (Phase 11) — the same rating/concierge/
              delivery facts already scroll in the TickerBar directly above
              this hero, so repeating them here was redundant. */}
        </div>
      </div>
    </section>
  )
}
