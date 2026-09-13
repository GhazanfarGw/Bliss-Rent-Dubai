import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, Car, ChevronDown, MapPin } from 'lucide-react'
import { HERO_SLIDE_IMAGES } from '@/features/booking/heroSlides'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { useFleetStats } from '@/features/booking/useFleetStats'
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
 * auto-changes again (image and layout stay as Phase 11 left it — no
 * dots/arrows/slide counter, no image swapping, same transparent-header
 * treatment — see NavBar), and this pass adds three more premium touches
 * requested afterwards:
 *
 *  - A slow, one-time "ken burns" drift on the pinned image (never swaps
 *    which photo shows, just a subtle zoom so it doesn't feel like a flat
 *    static poster) — `.animate-hero-image-drift` in index.css.
 *  - A compact trust-signal row under the CTAs, fetched live from the
 *    same fleet/locations queries AboutPage's stats section and
 *    TickerBar's rate already use — never a hand-typed figure. This is
 *    deliberately different data from TickerBar's scrolling strip
 *    (service policies) so the two don't repeat each other in the same
 *    viewport; best-effort only, same as TickerBar — on failure the row
 *    just doesn't render.
 *  - A small "Scroll to explore" cue under the stats row that
 *    smooth-scrolls to the booking search section, matching the same
 *    `#booking-section` anchor the header CTA and final-CTA button
 *    already use. Kept inline in the content column rather than pinned
 *    to the hero's bottom edge, since BookingSearchSection intentionally
 *    overlaps up onto that edge with its own card (see
 *    BookingSearchSection.tsx) and the fixed TickerBar sits there too.
 *    Desktop-only (`lg:` and up, where the hero is a full-viewport-height
 *    section) — see the mobile note below for why it's hidden elsewhere.
 *
 * Mobile isn't just this same layout scaled down — two things are
 * deliberately different content decisions, not shrunk-in-place ones:
 *  - The CTA row: below `sm`, "Book Now" is the one full-width strong
 *    button and "View fleet" drops to a lighter underlined text link
 *    (same <Link>, responsive classes — still exactly one "View fleet"
 *    link in the DOM). Two full-width stacked blocks read heavy on a
 *    small screen; at `sm` and up both render as the original
 *    equally-weighted side-by-side buttons.
 *  - The scroll cue above is hidden below `lg` entirely: it only makes
 *    sense where the hero deliberately fills the whole viewport and
 *    "there's more below" isn't obvious. Mobile's hero is a normal,
 *    much shorter block that already previews the next section, so the
 *    cue would just be extra vertical clutter there.
 *
 * All of the above skip themselves for prefers-reduced-motion, same as
 * every other autoplay/animation in this app (see src/lib/motion.ts).
 */
export function Hero() {
  const { t } = useTranslation()
  const slides = t('hero.slides', { returnObjects: true }) as Slide[]
  const [slideIndex, setSlideIndex] = useState(HERO_SLIDE_INDEX)
  const stats = useFleetStats()
  const slide = slides[slideIndex] ?? slides[0]
  const image = HERO_SLIDE_IMAGES[HERO_SLIDE_INDEX] ?? HERO_SLIDE_IMAGES[0]
  const reducedMotion = prefersReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion()) return
    const slideCount = slides.length
    if (slideCount <= 1) return
    const id = setInterval(() => {
      setSlideIndex((current) => (current + 1) % slideCount)
    }, HERO_TEXT_ROTATE_MS)
    return () => clearInterval(id)
  }, [slides.length])

  function handleScrollCueClick() {
    const target = document.getElementById('booking-section')
    // jsdom (unit tests) doesn't implement scrollIntoView — guard, same
    // pattern as ManageBookingPage.tsx.
    if (typeof target?.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
    }
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
        className={
          'absolute inset-0 h-full w-full object-cover object-center saturate-[1.1] contrast-[1.05]' +
          (reducedMotion ? '' : ' animate-hero-image-drift')
        }
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
      <div className="relative z-10 mx-auto flex min-h-[600px] max-w-7xl items-end px-4 pb-20 pt-[calc(var(--header-h)+var(--ticker-h))] sm:px-6 lg:min-h-[99vh] lg:pb-20 lg:px-8">
        <div className="max-w-xl pb-40 md:pb-28 lg:pb-28">
          <div className="mb-5 inline-flex items-center gap-2 border border-[#fff]/35 bg-[#120f0a]/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.33em] text-[#fff] backdrop-blur-md shadow-[0_12px_28px_rgba(17,13,8,0.32)]">
            {/* "Live" pulsing dot — a brand-champagne ping ring behind the
                existing static brand-gold square (both already-approved
                brand colors, no new hue introduced). Skipped for
                prefers-reduced-motion, leaving just the plain dot. */}
            <span className="relative flex h-2 w-2">
              {!reducedMotion && (
                <span className="absolute inline-flex rounded-full h-full w-full animate-ping bg-green-300 opacity-75" />
              )}
              <span className="relative rounded-full inline-flex h-2 w-2 bg-green-700" />
            </span>
            {t('hero.badge')}
          </div>

          {/* key={slideIndex} remounts this block on every rotation so the
              fade-in plays each time; skipped for prefers-reduced-motion
              by simply not applying the animation class (content still
              updates instantly, just without the transition). */}
          <div key={slideIndex} className={reducedMotion ? undefined : 'animate-hero-slide-fade'}>
            {/* leading-[0.92]/tracking-[-0.065em] matches the same tight
                "premium display heading" pair RequirementsSection already
                uses at a similarly huge size — the old leading-[0.84] here
                was tighter than that sitewide convention, tight enough
                that a two-line title's descenders (a slide ending in "y",
                "g", etc.) visually crowded the subtitle right below it on
                every screen size. mt-6 on the subtitle (was mt-5) gives a
                little extra breathing room on top of that.
                Base size dropped text-4xl -> text-3xl (mobile only —
                sm/lg unchanged): the longer titles ("Airport arrivals,
                made easy", "Choose your right ride") at font-black
                text-4xl plus the full-width Book Now block right below
                made the whole top of the mobile hero feel oversized —
                heading and button both reading "big" back to back, per
                live feedback. One step down keeps it a bold display
                heading without it, and every slide's title still wraps
                to exactly the same two lines it did before. */}
            <h1 className="text-5xl font-semibold leading-[0.92] tracking-[-0.065em] text-white md:drop-shadow-[0_16px_28px_rgba(0,0,0,0.3)] sm:text-5xl lg:text-6xl">
              <span className="block text-white">{slide.title}</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-white/80 sm:text-lg">{slide.body}</p>
          </div>

          {/* Mobile gets a deliberately different CTA arrangement, not just
              a shrunk desktop one: two full-width stacked blocks read heavy
              on a small screen, so below `sm` "Book Now" stays the one
              strong full-width button (fullWidthOnMobile) and "View fleet"
              drops to a lighter underlined text link with a small arrow —
              same destination, less visual weight. At `sm` and up both
              render as the original equally-weighted side-by-side buttons
              (Tailwind classes on the SAME <Link>, not a second element, so
              there's still exactly one "View fleet" link in the DOM). */}
          <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            {/* Direct navigation, not an on-page scroll: "Book Now" opens the
                dedicated Book a Car page and "View fleet" opens the full
                fleet listing, matching the header's own CTA/Fleet routes. */}
            <LinkButton
              to="/book"
              variant="primary"
              // A soft brand-champagne glow pulses behind the button below
              // `sm`, where it's the single dominant CTA (see the mobile
              // CTA note above). Desktop stays exactly shadow-none: the
              // .animate-hero-cta-glow/.hero-cta-glow-static classes only
              // carry any shadow/animation inside a max-width:639.98px
              // media query in index.css (not a competing `sm:` utility
              // here — see that file for why). Falls back to a fixed
              // (non-pulsing) glow for prefers-reduced-motion instead of
              // removing it outright.
              className={
                'group md:min-h-12 border border-brand-gold bg-brand-gold text-white shadow-none hover:brightness-105 ' +
                (reducedMotion ? 'hero-cta-glow-static' : 'animate-hero-cta-glow')
              }
            >
              {t('hero.cta')}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
            </LinkButton>
            <Link
              to="/search"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/85 underline decoration-white/40 underline-offset-4 transition-colors hover:text-white sm:min-h-12 sm:gap-0 sm:border sm:border-white/70 sm:bg-white sm:px-5 sm:py-3 sm:text-brand-navy sm:no-underline sm:transition-all sm:hover:bg-brand-lavender"
            >
              {t('hero.viewFleetCta')}
              <ArrowRight className="h-3.5 w-3.5 sm:hidden" aria-hidden="true" />
            </Link>
          </div>

          {/* Live trust signals — only the two numbers AboutPage's own
              stats section already treats as real (fleet size, city
              count). Absent entirely until the fetch resolves; never a
              placeholder/skeleton number. */}
          {stats && (
            // Below `sm` each stat gets its own bordered/backdrop-blur
            // chip (the same visual language as the badge above) so the
            // numbers hold their own against the photo on a small screen;
            // reset to the original plain inline pair at `sm` and up.
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-5">
              <div className="flex items-center gap-2 border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-sm sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
                <Car className="h-4 w-4 text-white" aria-hidden="true" />
                <span className="text-xs text-white/80">{t('pages.about.stats.vehicles', { count: stats.vehicleCount })}</span>
              </div>
              <div className="hidden h-4 w-px bg-white/25 sm:block" aria-hidden="true" />
              <div className="flex items-center gap-2 border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-sm sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
                <MapPin className="h-4 w-4 text-white" aria-hidden="true" />
                <span className="text-xs text-white/80">{t('pages.about.stats.cities', { count: stats.cityCount })}</span>
              </div>
            </div>
          )}

          {/* Scroll cue — a purely navigational nudge toward the booking
              search directly below, reusing the same #booking-section
              anchor the header CTA and homepage's final-CTA button
              already scroll to. Deliberately placed inline in this
              content column (not absolutely pinned to the hero's own
              bottom edge): BookingSearchSection overlaps up onto the
              hero's lower portion with its own -mt/z-10 card (see
              BookingSearchSection.tsx), so anything pinned to the hero's
              literal bottom would sit underneath that white card, or
              behind the fixed TickerBar strip, on shorter viewports.
              `hidden lg:inline-flex` on purpose, not left visible
              everywhere: it only earns its place where the hero
              deliberately fills the whole viewport (`lg:min-h-[100vh]`
              above) and "there's more below" isn't obvious. Below `lg`
              the hero is a normal, much shorter block that already
              previews the next section, and mobile users don't need a
              hint to scroll — so this row is one more thing removed
              from the mobile layout, not just shrunk in place. */}
          <button
            type="button"
            onClick={handleScrollCueClick}
            className="mt-8 hidden items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60 transition-colors hover:text-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold lg:inline-flex"
          >
            {t('hero.scrollCue')}
            <ChevronDown className={'h-4 w-4' + (reducedMotion ? '' : ' animate-bounce')} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
