import { useTranslation } from 'react-i18next'
import { HERO_SLIDE_IMAGES } from '@/features/booking/heroSlides'
import { prefersReducedMotion } from '@/lib/motion'
import { Button } from '@/features/shared/ui/Button'

interface Slide {
  title: string
  body: string
}

// The single static hero image/copy pair — reuses the exact same real
// asset and i18n content the former HeroCarousel rotated through (index 4:
// the premium sports-coupe shot, "Drive Dubai your way" / "A mix of
// premium and economy vehicles for city drives, short stays, and smooth
// arrivals." — a fitting general welcome line, nothing new invented).
const HERO_SLIDE_INDEX = 4

/**
 * The homepage's main visual focus, simplified per the Phase 11 header/hero
 * redesign: ONE static hero image — no carousel, no autoplay, no
 * dots/arrows/slide counter — with the site header overlaid transparently
 * on top of it (see NavBar). Structurally inspired by airline-style hero
 * layouts (the owner's reference); an ORIGINAL Bliss Rent treatment, not a
 * visual copy. Replaces HeroCarousel.tsx, which is removed.
 *
 * Reuses the exact same real image asset (HERO_SLIDE_IMAGES) and i18n copy
 * (`hero.*`) the former carousel used — just pinned to one slide instead of
 * rotating through five, so no new content is invented.
 */
export function Hero() {
  const { t } = useTranslation()
  const slides = t('hero.slides', { returnObjects: true }) as Slide[]
  const slide = slides[HERO_SLIDE_INDEX] ?? slides[0]
  const image = HERO_SLIDE_IMAGES[HERO_SLIDE_INDEX] ?? HERO_SLIDE_IMAGES[0]
  const reducedMotion = prefersReducedMotion()

  function scrollToBooking() {
    document.getElementById('booking-section')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
  }

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
      <div className="relative z-10 mx-auto flex min-h-[680px] max-w-7xl items-end px-4 pb-12 pt-[calc(var(--header-h)+var(--ticker-h))] sm:px-6 lg:min-h-[82vh] lg:pb-16 lg:px-8">
        <div className="max-w-xl lg:pb-10">
          <div className="mb-5 inline-flex items-center gap-2 border border-[#fff]/35 bg-[#120f0a]/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.33em] text-[#fff] backdrop-blur-md shadow-[0_12px_28px_rgba(17,13,8,0.32)]">
            <span className="h-2 w-2 bg-brand-gold" />
            {t('hero.badge')}
          </div>

          <h1 className="max-w-[12ch] text-4xl font-black leading-[0.84] tracking-[-0.08em] text-white drop-shadow-[0_16px_28px_rgba(0,0,0,0.3)] sm:text-5xl lg:text-[5.4rem]">
            <span className="block text-white">{slide.title}</span>
          </h1>

          <p className="mt-5 max-w-lg text-base leading-7 text-white/80 sm:text-lg">{slide.body}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="primary"
              onClick={scrollToBooking}
              className="min-h-12 border border-brand-gold bg-brand-gold text-white shadow-none hover:brightness-105"
            >
              {t('hero.cta')}
            </Button>
            <button
              type="button"
              onClick={scrollToBooking}
              className="inline-flex min-h-12 items-center justify-center border border-white/70 bg-white px-5 py-3 text-sm font-semibold text-brand-navy transition-all hover:bg-brand-lavender"
            >
              {t('hero.viewFleetCta')}
            </button>
          </div>
          {/* No trust-badge row here (Phase 11) — the same rating/concierge/
              delivery facts already scroll in the TickerBar directly above
              this hero, so repeating them here was redundant. */}
        </div>
      </div>
    </section>
  )
}
