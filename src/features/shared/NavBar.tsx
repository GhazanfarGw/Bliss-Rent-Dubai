import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, X } from 'lucide-react'
import { LanguageSwitcher } from '@/features/shared/LanguageSwitcher'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { PendingBookingIndicator } from '@/features/shared/PendingBookingIndicator'
import { prefersReducedMotion } from '@/lib/motion'

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={
        'flex items-center justify-center rounded-none font-black tracking-[0.18em] text-[#fff] shadow-none ' +
        (compact ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-[11px]') +
        ' bg-brand-gold'
      }
      aria-label="Bliss Rent Dubai"
      title="Bliss Rent Dubai"
    >
      BR
    </span>
  )
}

/**
 * Premium header. Desktop: logo, Home, Browse Fleet, Car Types, About,
 * Contact (all real pages — see src/features/content/), Services (still an
 * in-page anchor to the homepage's "How It Works" section, since it isn't
 * its own page), language switcher, and the primary "Search Cars" CTA.
 * Mobile: hamburger drawer with the same links plus the CTA.
 */
const TRANSPARENT_SCROLL_THRESHOLD_PX = 24

export function NavBar() {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const lastScrollY = useRef(0)
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
      const delta = currentScrollY - lastScrollY.current

      setScrolled(currentScrollY > TRANSPARENT_SCROLL_THRESHOLD_PX)

      if (open) {
        setVisible(true)
        lastScrollY.current = currentScrollY
        return
      }

      if (currentScrollY <= 8) {
        setVisible(true)
      } else if (delta <= -12) {
        setVisible(true)
      } else if (delta >= 12) {
        setVisible(false)
      }

      lastScrollY.current = currentScrollY
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [open])

  // A route change can land the page already scrolled to a hash target, or
  // leave a stale scrolled state from the previous page — resync immediately
  // rather than waiting for the next scroll event.
  useEffect(() => {
    setScrolled(window.scrollY > TRANSPARENT_SCROLL_THRESHOLD_PX)
  }, [location.pathname])

  useEffect(() => {
    document.documentElement.dataset.headerVisible = String(visible)
    window.dispatchEvent(new CustomEvent('headervisibilitychange', { detail: { visible } }))
  }, [visible])

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
    { to: '/contact', label: t('nav.contact'), end: false },
  ]
  const anchors = [{ to: { pathname: '/', hash: '#how-it-works' }, label: t('nav.services') }]

  return (
    <header
      className={
        'fixed top-0 z-40 w-full border-b ' +
        (reducedMotion ? '' : 'transition-[background-color,border-color,color,transform] duration-300 ease-out ') +
        (transparent ? 'border-transparent bg-transparent text-white ' : 'border-[#ece7df] bg-white text-brand-navy ') +
        (visible ? 'translate-y-0' : '-translate-y-full')
      }
    >
      <div className="mx-auto flex h-[var(--header-h)] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <BrandMark />
          <span className={'text-base font-bold tracking-[-0.03em] sm:text-lg ' + (transparent ? 'text-white' : 'text-brand-navy')}>
            {t('nav.brand')}
          </span>
        </Link>

        <nav aria-label={t('nav.primaryNavigation')} className="hidden max-w-full flex-1 items-center justify-center lg:flex">
          <div
            className={
              'flex max-w-full items-center gap-1 rounded-none border p-1.5 shadow-[inset_0_1px_0_rgba(17,20,29,0.02)] transition-colors ' +
              (transparent ? 'border-white/25 bg-white/10 backdrop-blur-md' : 'border-[#edf0ea] bg-[#f8f7f4]')
            }
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  'rounded-none px-3 py-2 text-sm font-medium transition-all ' +
                  (isActive
                    ? 'bg-white text-brand-navy shadow-sm ring-1 ring-[#ece7df]'
                    : transparent
                      ? 'text-white/85 hover:bg-white/15 hover:text-white'
                      : 'text-[#4a5360] hover:bg-white hover:text-brand-navy')
                }
              >
                {link.label}
              </NavLink>
            ))}
            {anchors.map((anchor) => (
              <Link
                key={anchor.label}
                to={anchor.to}
                className={
                  'rounded-none px-3 py-2 text-sm font-medium transition-all ' +
                  (transparent ? 'text-white/85 hover:bg-white/15 hover:text-white' : 'text-[#4a5360] hover:bg-white hover:text-brand-navy')
                }
              >
                {anchor.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <PendingBookingIndicator />
          <LanguageSwitcher tone={transparent ? 'light' : 'dark'} />
          <LinkButton
            to="/search"
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-none border border-[#e6e1d9] bg-[#f7f4ef] text-brand-navy shadow-sm transition-colors hover:bg-[#f1eee8]"
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
            'absolute end-0 top-0 flex h-screen w-full max-w-[100vw] flex-col gap-2 border-s border-brand-gold/10 bg-white/85 p-4 ' +
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
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                'rounded-xl border border-brand-gold/10 px-3 py-2.5 text-base font-medium ' +
                (isActive ? 'bg-brand-lavender/90 text-brand-gold shadow-sm' : 'bg-white/60 text-brand-navy/80 hover:bg-brand-lavender/60 hover:text-brand-gold')
              }
            >
              {link.label}
            </NavLink>
          ))}
          {anchors.map((anchor) => (
            <Link
              key={anchor.label}
              to={anchor.to}
              onClick={() => setOpen(false)}
              className="rounded-none border border-brand-gold/10 bg-white/60 px-3 py-2.5 text-base font-medium text-slate-700 backdrop-blur-sm hover:bg-brand-lavender/60 hover:text-brand-gold"
            >
              {anchor.label}
            </Link>
          ))}
          <div className="mt-auto space-y-3 pt-3">
            <LinkButton
              to="/search"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="w-full text-center shadow-[0_10px_24px_rgba(180,155,108,0.2)]"
            >
              {t('nav.searchCars')}
            </LinkButton>

            <div className="flex items-center justify-center gap-3 border-t border-brand-gold/10 pt-3">
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
                href="https://wa.me/971500000000"
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
        </nav>
      </div>
    </header>
  )
}
