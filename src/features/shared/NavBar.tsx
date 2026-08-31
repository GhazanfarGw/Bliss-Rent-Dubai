import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/features/shared/LanguageSwitcher'
import { LinkButton } from '@/features/shared/ui/LinkButton'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * Premium header. Desktop: logo, Home, Browse Fleet, Car Types, About,
 * Contact (all real pages — see src/features/content/), Services (still an
 * in-page anchor to the homepage's "How It Works" section, since it isn't
 * its own page), language switcher, and the primary "Search Cars" CTA.
 * Mobile: hamburger drawer with the same links plus the CTA.
 */
export function NavBar() {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(true)
  const lastScrollY = useRef(0)
  const { t } = useTranslation()
  const reducedMotion = prefersReducedMotion()

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY
      const scrollingUp = currentScrollY < lastScrollY.current
      const atTop = currentScrollY <= 12

      setVisible(atTop || scrollingUp)
      if (currentScrollY > lastScrollY.current && open) setOpen(false)
      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [open])

  useEffect(() => {
    document.documentElement.dataset.headerVisible = String(visible)
    window.dispatchEvent(new CustomEvent('headervisibilitychange', { detail: { visible } }))
  }, [visible])

  const links = [
    { to: '/', label: t('nav.home'), end: true },
    { to: '/about', label: t('nav.about'), end: false },
    { to: '/search', label: t('nav.browseFleet'), end: false },
    { to: '/car-types', label: t('nav.carTypes'), end: false },
    { to: '/contact', label: t('nav.contact'), end: false },
  ]
  const anchors = [{ to: { pathname: '/', hash: '#how-it-works' }, label: t('nav.services') }]

  return (
    <header className={'sticky top-0 z-40 border-b border-brand-navy/10 bg-white/95 backdrop-blur ' + (reducedMotion ? '' : 'transition-transform duration-300 ') + (visible ? 'translate-y-0' : '-translate-y-full')}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-navy text-sm font-bold text-white">
            BR
          </span>
          <span className="text-base font-semibold text-brand-navy sm:text-lg">
            {t('nav.brand')}
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                'text-sm font-medium transition-colors ' +
                (isActive ? 'text-brand-navy' : 'text-slate-500 hover:text-brand-navy')
              }
            >
              {link.label}
            </NavLink>
          ))}
          {anchors.map((anchor) => (
            <Link
              key={anchor.label}
              to={anchor.to}
              className="text-sm font-medium text-slate-500 transition-colors hover:text-brand-navy"
            >
              {anchor.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <LanguageSwitcher />
          <LinkButton to="/search" variant="secondary" size="compact">
            {t('nav.searchCars')}
          </LinkButton>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-navy"
            aria-label={t('nav.toggleMenu')}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-brand-navy/10 bg-white px-4 py-3 lg:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                'block rounded-md px-3 py-2 text-sm font-medium ' +
                (isActive ? 'bg-brand-lavender text-brand-navy' : 'text-slate-600 hover:bg-brand-lavender/60')
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
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-lavender/60"
            >
              {anchor.label}
            </Link>
          ))}
          <LinkButton
            to="/search"
            variant="secondary"
            onClick={() => setOpen(false)}
            className="mt-2 w-full text-center"
          >
            {t('nav.searchCars')}
          </LinkButton>
        </nav>
      )}
    </header>
  )
}
