import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { readCookieConsent, storeCookieConsent, type CookieConsent } from '@/lib/cookieConsent'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * A first-visit cookie notice — Accept / Decline, plus a link to the real
 * Cookie Policy page. Shows once per browser (see cookieConsent.ts for
 * the `dxb-cookie-consent` key) until the visitor picks either option;
 * picking either one just records the choice and dismisses the banner
 * for good — see cookieConsent.ts for why "Decline" doesn't disable
 * anything functional (there is nothing non-essential to disable today).
 *
 * Fixed to the bottom, above the footer and any other page content,
 * `z-40` (same layer as NavBar's fixed header, which sits at the top —
 * the two never overlap) so it reads as a persistent site-level notice
 * rather than part of any one page.
 */
export function CookieConsentBanner() {
  const { t } = useTranslation()
  const [consent, setConsent] = useState<CookieConsent | null>('accepted') // optimistic default avoids a flash on repeat visits
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(false)
  const reducedMotion = prefersReducedMotion()

  useEffect(() => {
    const stored = readCookieConsent()
    setConsent(stored)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready || consent) return
    // A tick after mount so the enter transition actually plays instead
    // of starting already in its end state.
    const id = window.setTimeout(() => setVisible(true), reducedMotion ? 0 : 50)
    return () => window.clearTimeout(id)
  }, [ready, consent, reducedMotion])

  function choose(next: CookieConsent) {
    storeCookieConsent(next)
    setVisible(false)
    setConsent(next)
  }

  if (!ready || consent) return null

  return (
    <div
      role="region"
      aria-label={t('cookieConsent.ariaLabel')}
      className={
        'fixed inset-x-0 bottom-0 z-40 border-t border-[#ece7df] bg-white px-4 py-4 shadow-[0_-12px_30px_rgba(15,18,22,0.08)] sm:px-6 lg:px-8 ' +
        (reducedMotion ? '' : 'transition-transform duration-300 ease-out ') +
        (visible ? 'translate-y-0' : 'translate-y-full')
      }
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-center text-sm leading-6 text-text-muted sm:text-start">
          {t('cookieConsent.message')}{' '}
          <Link to="/cookie-policy" className="font-semibold text-brand-navy underline decoration-brand-gold decoration-2 underline-offset-4">
            {t('cookieConsent.learnMore')}
          </Link>
        </p>

        <div className="flex w-full shrink-0 items-center gap-3 sm:w-auto">
          <button
            type="button"
            onClick={() => choose('declined')}
            className="flex-1 border border-border px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-muted sm:flex-none"
          >
            {t('cookieConsent.decline')}
          </button>
          <button
            type="button"
            onClick={() => choose('accepted')}
            className="flex-1 border border-brand-gold bg-brand-gold px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-105 sm:flex-none"
          >
            {t('cookieConsent.accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
