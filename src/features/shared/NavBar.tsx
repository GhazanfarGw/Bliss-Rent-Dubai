import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarSearch, CarFront, ChevronRight, ClipboardCheck, Home, Info, LogIn, MapPin, Menu, Phone, Search, X } from 'lucide-react'
import { LanguageSwitcher } from '@/features/shared/LanguageSwitcher'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { PendingBookingIndicator } from '@/features/shared/PendingBookingIndicator'
import { WHATSAPP_URL } from '@/features/booking/contactLinks'
import { prefersReducedMotion } from '@/lib/motion'
import logoFull from '@/assets/brand/logo-full.png'
import logoMark from '@/assets/brand/logo-mark.png'

/**
 * Real brand artwork (supplied directly, not generated) replacing the
 * placeholder "BR" initials badge + plain-text wordmark that stood in for
 * a logo up to this point. `logoFull` is the full bilingual lockup (used
 * everywhere there's room — desktop header, mobile drawer's open header);
 * `logoMark` is the same artwork's icon-only crop (Burj Al Arab + BR
 * monogram, no wordmark) for tight spaces — currently unused here but
 * exported for any future compact placement, and it's also the source for
 * every generated favicon size (see index.html).
 */
function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src={compact ? logoMark : logoFull}
      alt="Bliss Rent Dubai"
      className={compact ? 'h-8 w-auto' : 'h-9 w-auto sm:h-10'}
    />
  )
}

const NAV_ICONS = [Home, Info, CarFront, MapPin, CalendarSearch, ClipboardCheck, Phone]
const NAV_DESCRIPTIONS = ['nav.homeDescription', 'nav.aboutDescription', 'nav.browseFleetDescription', 'nav.carTypesDescription', 'nav.findMyCarDescription', 'nav.manageBookingDescription', 'nav.contactDescription'] as const

/**
 * Premium header. Desktop: logo, Home, About, Browse Fleet, Car Types,
 * Find My Car, Manage Booking, Contact (all real pages — see
 * src/features/content/, FindMyCarPage.tsx, and ManageBookingPage.tsx),
 * Services (still an in-page anchor to the homepage's "How It Works"
 * section, since it isn't its own page), language switcher, and the
 * primary "Search Cars"/"Book Now" CTA. Mobile: hamburger drawer with the
 * same links plus the CTA.
 *
 * Manage Booking was previously reachable only from an email link, the
 * homepage navigator's own tab, or the footer — never the header itself —
 * so a guest browsing from any other page had no direct way there.
 *
 * Find My Car is a separate, dedicated header link (own icon/description
 * in NAV_ICONS/NAV_DESCRIPTIONS above) so a guest who only wants a quick
 * status check is never routed through the full Manage Booking page —
 * see FindMyCarPage.tsx / BookingStatusPanel.tsx.
 *
 * The CTA points at /book (BookCarPage) rather than straight at /search:
 * its whole job is "start a booking", and BookCarPage is the dedicated
 * page built for exactly that — the same SearchWidget fields and
 * `onSearch` → /search flow, just presented as its own destination
 * instead of only living inside the homepage hero.
 */
const TRANSPARENT_SCROLL_THRESHOLD_PX = 24

export function NavBar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const reducedMotion = prefersReducedMotion()
  const isRtl = i18n.dir() === 'rtl'

  // Only the homepage renders full-bleed hero art directly under the fixed
  // header (see Hero's `-mt-[var(--header-h)]`), so the
  // transparent-over-hero treatment is scoped to it — every other page's
  // content starts below the header anyway, so it would just show white
  // through a transparent bar there.
  const isHome = location.pathname === '/'
  const transparent = isHome && !scrolled

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY
      setScrolled(currentScrollY > TRANSPARENT_SCROLL_THRESHOLD_PX)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // A route change can land the page already scrolled to a hash target, or
  // leave a stale scrolled state from the previous page — resync immediately
  // rather than waiting for the next scroll event.
  useEffect(() => {
    setScrolled(window.scrollY > TRANSPARENT_SCROLL_THRESHOLD_PX)
  }, [location.pathname])

  useEffect(() => {
    document.documentElement.dataset.headerVisible = 'true'
    window.dispatchEvent(new CustomEvent('headervisibilitychange', { detail: { visible: true } }))
  }, [])

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.documentElement.style.overflow = ''
      return
    }

    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.documentElement.style.overflow = ''
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' })
    }
  }, [open])

  const links = [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/about', label: t('nav.about'), end: false },
    { to: '/search', label: t('nav.browseFleet'), end: false },
    { to: '/car-types', label: t('nav.carTypes'), end: false },
    { to: '/find-my-car', label: t('nav.findMyCar'), end: false },
    { to: '/manage-booking', label: t('nav.manageBooking'), end: false },
    { to: '/contact', label: t('nav.contact'), end: false },
  ]
  const anchors = [{ to: { pathname: '/', hash: '#how-it-works' }, label: t('nav.services') }]

  return (
    <header
      className={
        'fixed top-0 z-40 h-[var(--header-h)] w-full border-b ' +
        // Bug fix: the transparent (homepage-hero) state used to render at a
        // taller 4.5rem while the scrolled/solid state used --header-h (4rem)
        // — but TickerBar and StickySearchBar both position themselves at a
        // fixed `top: var(--header-h)` regardless of which state the header is
        // in, assuming the header is always exactly --header-h tall. That 8px
        // mismatch showed up as a visible seam/overlap right at the top of the
        // homepage. The header now stays exactly --header-h tall in both
        // states, so every fixed element anchored to it lines up correctly.
        (reducedMotion ? '' : 'transition-[background-color,border-color,box-shadow,color] duration-300 ease-out ') +
        (transparent ? 'border-transparent bg-transparent text-white ' : 'border-[#ece7df] bg-white text-brand-navy shadow-[0_8px_24px_rgba(11,19,43,0.07)]')
      }
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className={
            'flex items-center rounded-none transition-colors duration-300 ' +
            (transparent ? 'px-3 py-1.5' : '')
          }
          onClick={() => setOpen(false)}
        >
          <picture>
            <img
              src={logoFull}
              alt="Bliss Rent Dubai"
              className={'hidden w-auto transition-[height,filter] duration-300 ease-out lg:block ' + (transparent ? 'h-11 brightness-0 invert' : 'h-9')}
            />
            <img
              src={transparent ? logoMark : logoFull}
              alt="Bliss Rent Dubai"
              className={'w-auto transition-[height,filter] duration-300 ease-out lg:hidden ' + (transparent ? 'h-11 brightness-0 invert' : 'h-9')}
            />
          </picture>
        </Link>

        <nav aria-label={t('nav.primaryNavigation')} className="hidden max-w-full flex-1 items-center justify-center lg:flex">
          <div
            className={
              'flex max-w-full items-center gap-2 transition-colors ' + (transparent ? 'bg-transparent' : '')
            }
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  'relative rounded-none px-3 py-2 text-sm font-medium transition-all ' +
                  (isActive
                    ? 'text-brand-gold after:absolute after:inset-x-3 after:-bottom-1 after:h-0.5 after:bg-brand-champagne'
                      : transparent
                      ? 'text-white/90 hover:text-white'
                      : 'text-[#4a5360] hover:text-brand-gold')
                }
              >
                {link.label}
              </NavLink>
            ))}
            {anchors.map((anchor) => (
              <Link
                key={anchor.label}
                to={anchor.to}
                  className={'rounded-none px-3 py-2 text-sm font-medium transition-all ' + (transparent ? 'text-white/90 hover:text-white' : 'text-[#4a5360] hover:text-brand-gold')}
              >
                {anchor.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <PendingBookingIndicator />
          <Link
            to="/admin/login"
            className={
              'flex items-center gap-1.5 rounded-none px-2 py-2 text-sm font-medium transition-colors ' +
              (transparent ? 'text-white/80 hover:text-white' : 'text-[#4a5360] hover:text-brand-gold')
            }
          >
            <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t('nav.adminSignIn')}
          </Link>
          <LanguageSwitcher tone={transparent ? 'light' : 'dark'} />
          <LinkButton
            to="/book"
            variant="primary"
            size="compact"
            className="border border-brand-gold text-white shadow-none"
          >
            {t('nav.searchCars')}
          </LinkButton>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <PendingBookingIndicator />
          <LanguageSwitcher tone={transparent ? 'light' : 'dark'} />
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-none border border-[#e6e1d9] bg-[#f7f4ef] text-brand-navy shadow-sm transition-colors hover:bg-[#f1eee8]"
            aria-label={t('nav.toggleMenu')}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div
        className={
          'pointer-events-none fixed inset-0 z-50 lg:hidden ' +
          (open ? 'pointer-events-auto' : 'hidden')
        }
        aria-hidden={!open}
      >
        <div className="absolute inset-0 bg-brand-gold/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />

        <nav
          className={
            'absolute end-0 top-0 flex h-dvh max-h-dvh w-full max-w-[100vw] flex-col gap-2 overflow-y-auto border-s border-brand-gold/10 bg-white/85 p-4 ' +
            (reducedMotion ? '' : isRtl ? 'animate-[slide-in-left_0.28s_ease-out]' : 'animate-[slide-in-right_0.28s_ease-out]')
          }
        >
          <div className="mb-2 flex items-center justify-between border-b border-brand-gold/10 bg-white/10 pb-3">
            <div className="flex items-center gap-3">
              <BrandMark compact />
              <span className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-gold">Menu</span>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-brand-gold/10 bg-white/70 text-brand-gold shadow-none"
              aria-label={t('nav.toggleMenu')}
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {links.map((link) => (
            (() => {
              const Icon = NAV_ICONS[links.indexOf(link)]
              const descriptionKey = NAV_DESCRIPTIONS[links.indexOf(link)]
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    'flex min-h-14 items-center gap-3 border-b border-brand-navy/10 px-2 py-3 transition-colors ' +
                    (isActive ? 'text-brand-gold' : 'text-brand-navy hover:text-brand-gold')
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">{link.label}</span>
                    <span className="mt-0.5 block text-xs text-text-muted">{t(descriptionKey)}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
                </NavLink>
              )
            })()
          ))}
          {anchors.map((anchor) => (
            <Link
              key={anchor.label}
              to={anchor.to}
              onClick={() => setOpen(false)}
              className="flex min-h-14 items-center gap-3 border-b border-brand-navy/10 px-2 py-3 text-brand-navy transition-colors hover:text-brand-gold"
            >
              <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{anchor.label}</span>
                <span className="mt-0.5 block text-xs text-text-muted">{t('nav.servicesDescription')}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
            </Link>
          ))}
          <div className="mt-auto space-y-3 pt-5">
            <LinkButton
              to="/book"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="w-full text-center shadow-[0_10px_24px_rgba(180,155,108,0.2)]"
            >
              {t('nav.searchCars')}
            </LinkButton>

            <Link
              to="/admin/login"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-none border border-brand-navy/10 bg-white/70 px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-lavender"
            >
              <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t('nav.adminSignIn')}
            </Link>

            <div className="border-t border-brand-navy/10 pt-3">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold">{t('nav.connect')}</p>
              <div className="flex items-center justify-center gap-3">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-gold/10 bg-white/70 text-brand-gold shadow-sm transition-colors hover:bg-brand-lavender"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-gold/10 bg-white/70 text-brand-gold shadow-sm transition-colors hover:bg-brand-lavender"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M13.5 21v-8h2.5l.4-3h-2.9V7.5c0-.9.3-1.5 1.6-1.5H16V3.1c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.7-4.5 4.7V10H6.5v3h2.3v8h4.7Z" />
                </svg>
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-gold/10 bg-white/70 text-brand-gold shadow-sm transition-colors hover:bg-brand-lavender"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M19.05 4.95A9.9 9.9 0 0 0 12 2a9.94 9.94 0 0 0-8.64 15.12L2 22l5.02-1.31A9.9 9.9 0 0 0 12 22c5.52 0 10-4.48 10-10a9.9 9.9 0 0 0-2.95-7.05ZM12 19.2c-1.52 0-3.01-.41-4.29-1.19l-.31-.18-2.98.78.8-2.9-.2-.3A8.18 8.18 0 0 1 3.8 12a8.2 8.2 0 1 1 14.46 5.8l-.25.2-2.88.75.77 2.65-.18.3A8.14 8.14 0 0 1 12 19.2Zm4.53-6.12c-.25-.13-1.47-.72-1.7-.81-.22-.09-.39-.13-.55.13-.16.25-.62.81-.76.98-.14.16-.27.18-.52.06-.25-.13-1.05-.39-1.99-1.25-.73-.65-1.22-1.45-1.36-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.27.38-.41.13-.13.17-.22.25-.38.08-.16.04-.3-.02-.41-.06-.13-.55-1.32-.75-1.81-.2-.48-.4-.4-.55-.41h-.48c-.16 0-.41.06-.62.3-.21.25-.79.78-.79 1.9s.82 2.21.93 2.36c.11.16 1.62 2.48 3.92 3.46.55.24.98.39 1.31.5.55.18 1.06.15 1.45.09.44-.06 1.47-.6 1.67-1.18.2-.58.2-1.08.14-1.19-.06-.1-.22-.16-.47-.29Z" />
                </svg>
              </a>
            </div>
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}
