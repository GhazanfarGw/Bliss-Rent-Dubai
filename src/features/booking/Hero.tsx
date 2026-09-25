import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { HERO_SLIDE_IMAGES, HERO_VIDEO_SOURCES, HERO_VIDEO_DESKTOP_MEDIA_QUERY } from '@/features/booking/heroSlides'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { prefersReducedMotion } from '@/lib/motion'

/** Which HERO_SLIDE_IMAGES still frame is the video's poster (and the prefers-reduced-motion image). */
const HERO_POSTER_INDEX = 4

/**
 * The homepage hero: a full-bleed looping video with ONE heading, ONE
 * supporting sentence and two calls to action — the same editorial
 * treatment as the About page's hero. (The live-numbers strip was removed
 * at the owner's request.)
 *
 * Deliberately still. The video is the only thing that moves: the old
 * auto-rotating heading/body text, its fade-in on every swap, the pulsing
 * badge dot, the pulsing mobile CTA glow and the bouncing scroll chevron are
 * all gone, so nothing competes with the footage for attention (and there's
 * no auto-changing text for a visitor to chase or for assistive tech to
 * announce — see WCAG 2.2.2). `prefers-reduced-motion` still swaps the video
 * for its still poster frame.
 *
 * - Video: desktop and mobile play different clips (`<source media=...>`
 *   pairs, checked once at load at the `lg:` breakpoint — see
 *   HERO_VIDEO_SOURCES in heroSlides.ts, unchanged).
 * - Legibility: a tint wash, a start-side reading scrim (mirrored in RTL so
 *   the dark side always sits behind the text), and top/bottom fades.
 * - Content is vertically centred; the bottom padding leaves room for
 *   BookingSearchSection's card, which overlaps up onto this hero's lower
 *   edge (see BookingSearchSection.tsx), so the CTAs and scroll cue never
 *   end up underneath it.
 * - The scroll cue is desktop-only (`lg:`), where the hero fills the whole
 *   viewport and "there's more below" isn't obvious; on mobile the hero is a
 *   shorter block (640px — owner prefers it to full-screen) that already
 *   previews the next section.
 */
export function Hero() {
  const { t } = useTranslation()
  const image = HERO_SLIDE_IMAGES[HERO_POSTER_INDEX] ?? HERO_SLIDE_IMAGES[0]
  const reducedMotion = prefersReducedMotion()

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
      {reducedMotion ? (
        // No autoplaying video for prefers-reduced-motion — same still
        // frame the video would otherwise open on.
        <img
          src={image.src}
          alt={t(image.altKey)}
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-center saturate-[1.1] contrast-[1.05]"
        />
      ) : (
        <video
          autoPlay
          loop
          muted
          playsInline
          poster={image.src}
          aria-label={t(image.altKey)}
          className="absolute inset-0 h-full w-full object-cover object-center saturate-[1.1] contrast-[1.05]"
        >
          {/* Desktop and mobile play different clips — `media` is checked
              once when the browser picks a source (not live on resize),
              at the same lg: breakpoint (1024px) this hero's own layout
              classes use, so video and layout switch together. Desktop
              sources listed first: a source is skipped once its `media`
              fails to match, so mobile's plain (no-`media`) sources below
              only get used when the desktop ones didn't. */}
          <source media={HERO_VIDEO_DESKTOP_MEDIA_QUERY} src={HERO_VIDEO_SOURCES.desktop.webm} type="video/webm" />
          <source media={HERO_VIDEO_DESKTOP_MEDIA_QUERY} src={HERO_VIDEO_SOURCES.desktop.mp4} type="video/mp4" />
          <source src={HERO_VIDEO_SOURCES.mobile.webm} type="video/webm" />
          <source src={HERO_VIDEO_SOURCES.mobile.mp4} type="video/mp4" />
        </video>
      )}

      {/* Full-frame brand tint (owner's request) under three legibility
          layers: a start-side reading scrim (rtl:-scale-x-100 mirrors it so
          it always sits behind the text), a bottom fade, and a top fade for
          the transparent header. */}
      <div className="absolute inset-0 bg-brand-gold-dark/10" />
      {/* Below lg the text runs the full width, so a start-side scrim would
          leave its far half on the bright car — phones/tablets get an even
          wash instead; desktop keeps the side scrim. */}
      <div className="absolute inset-0 bg-[#05070d]/30 lg:hidden" />
      <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,rgba(5,7,13,0.8)_0%,rgba(5,7,13,0.52)_36%,rgba(5,7,13,0.1)_68%,rgba(5,7,13,0)_100%)] rtl:-scale-x-100 lg:block" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#05070d]/75 via-transparent via-45% to-transparent" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#05070d]/55 to-transparent" />

      {/* Content is vertically centred in the screen height (owner's
          request) — centred in the visible band between the header and
          BookingSearchSection's overlapping card: top padding = header +
          2rem, bottom padding = the card's overlap (-mt-16 = 4rem on sm+)
          + 2rem. */}
      <div className="relative z-10 mx-auto flex min-h-[640px] max-w-7xl items-center px-4 pb-24 pt-[calc(var(--header-h)+2rem)] sm:px-6 lg:min-h-[100vh] lg:px-8">
        <div className="w-full max-w-3xl">
          <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-brand-champagne sm:text-[11px] sm:tracking-[0.34em]">
            <span className="h-px w-8 shrink-0 bg-brand-champagne sm:w-10" aria-hidden="true" />
            {t('hero.eyebrow')}
          </p>

          {/* The serif display heading (Playfair Display, falling back to
              Cairo for Arabic — see index.css). The accent line is a
              literal-space-separated block so the accessible name reads
              "Drive Your Journey with Bliss Rent" as one phrase; it's
              italic in Latin only — a slanted Arabic face just looks broken.
              Phone size scales with the screen width (11vw) so "Drive Your
              Journey" fills the line without wrapping, even at 320px. */}
          <h1 className="font-hero-serif mt-4 text-[clamp(2.125rem,11vw,2.875rem)] font-semibold leading-none sm:mt-5 tracking-[-0.06em] text-white [text-shadow:0_2px_32px_rgba(0,0,0,0.35)] sm:text-6xl lg:text-7xl">
            <span className="block">{t('hero.title')}</span>{' '}
            <span className="block font-medium italic text-brand-champagne rtl:not-italic">{t('hero.titleAccent')}</span>
          </h1>

          {/* text-pretty keeps a lone word from being stranded on the last line. */}
          <p className="mt-5 max-w-xl text-pretty text-[0.9375rem] leading-7 text-white/85 sm:mt-6 sm:text-lg sm:leading-8">{t('hero.body')}</p>

          {/* Direct navigation, not an on-page scroll: "Book Now" opens
              Fleet's own search dialog directly and "View fleet" the plain
              fleet listing, matching the header's own CTA/Fleet routes.
              Phones: two equal columns spanning the full text width. */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <LinkButton to="/search?mode=book" variant="primary" className="group min-h-12 sm:min-w-40">
              {t('hero.cta')}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
            </LinkButton>
            <Link
              to="/search"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:border-white hover:bg-white hover:text-brand-navy sm:min-w-40"
            >
              {t('hero.viewFleetCta')}
            </Link>
          </div>

          <button
            type="button"
            onClick={handleScrollCueClick}
            className="mt-8 hidden items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60 transition-colors hover:text-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold lg:inline-flex"
          >
            {t('hero.scrollCue')}
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
