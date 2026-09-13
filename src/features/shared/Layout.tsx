import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { NavBar } from '@/features/shared/NavBar'
import { Footer } from '@/features/shared/Footer'
import { CookieConsentBanner } from '@/features/shared/CookieConsentBanner'
import { FeedbackWidget } from '@/features/shared/FeedbackWidget'
import { SupportChatWidget } from '@/features/shared/SupportChatWidget'
import { prefersReducedMotion } from '@/lib/motion'

export function Layout() {
  const location = useLocation()

  // Smoothly scrolls to an in-page anchor (e.g. the header's About/Services
  // links to #why-choose / #how-it-works) whenever the URL hash changes,
  // including navigation from a different page — react-router doesn't do
  // this automatically. Each target section sets `scroll-mt-*` so it isn't
  // hidden behind the sticky header.
  useEffect(() => {
    if (!location.hash) return
    const el = document.getElementById(location.hash.slice(1))
    el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }, [location])

  return (
    <div className="flex min-h-screen flex-col bg-white text-brand-navy">
      <NavBar />
      {/* NavBar is `fixed`, so it's out of document flow — every page's
          content must clear its height itself. `pt-[var(--header-h)]` here
          is the one place that happens, instead of each page guessing its
          own top padding (see index.css for the shared --header-h token).
          HomePage's Hero is the single deliberate exception: it
          negates this padding to sit full-bleed under the translucent
          header, and documents why at its own definition. */}
      <main className="flex-1 pt-[var(--header-h)]">
        <Outlet />
      </main>
      <Footer />
      <CookieConsentBanner />
      <FeedbackWidget />
      <SupportChatWidget />
    </div>
  )
}
