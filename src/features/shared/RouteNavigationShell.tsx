import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { prefersReducedMotion } from '@/lib/motion'

const ROUTE_LOADER_DURATION_MS = 450

interface RouteNavigationShellProps {
  children: ReactNode
}

export function RouteNavigationShell({ children }: RouteNavigationShellProps) {
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const [visible, setVisible] = useState(false)
  const previousPathRef = useRef(location.pathname)

  const reducedMotion = prefersReducedMotion()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const isRtl = i18n.dir() === 'rtl'

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname, location.hash])

  useEffect(() => {
    const pathChanged = previousPathRef.current !== location.pathname
    previousPathRef.current = location.pathname

    if (isAdminRoute || reducedMotion || !pathChanged) {
      setVisible(false)
      return
    }

    setVisible(true)
    const timeout = window.setTimeout(() => setVisible(false), ROUTE_LOADER_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [isAdminRoute, location.pathname, reducedMotion])

  return (
    <>
      {!isAdminRoute && visible && (
        <div
          aria-live="polite"
          aria-busy="true"
          role="status"
          dir={isRtl ? 'rtl' : 'ltr'}
          className="route-loader-overlay"
        >
          <div className="route-loader-panel">
            {reducedMotion ? (
              <div className="route-loader-static">
                <span className="route-loader-dot" aria-hidden="true" />
                <span>{t('common.routeLoadingTitle')}</span>
              </div>
            ) : (
              <>
                <div className="route-loader-track" aria-hidden="true">
                  <div className="route-loader-car-wrap">
                    <svg viewBox="0 0 96 42" className="route-loader-car" aria-hidden="true">
                      <path d="M10 28h62l8-11c1.2-1.8 2.8-2.7 4.7-2.7H88c2.2 0 4 1.8 4 4v10.5c0 2.2-1.8 4-4 4H80c-2.2 0-4-1.8-4-4V23H34v7c0 2.2-1.8 4-4 4H18c-2.2 0-4-1.8-4-4v-4h-4c-2.2 0-4-1.8-4-4v-4c0-2.2 1.8-4 4-4h8l7-4h31c1.3 0 2.5.5 3.4 1.4l7.7 7.6H10z" fill="currentColor" />
                      <circle cx="28" cy="30" r="7" fill="currentColor" />
                      <circle cx="70" cy="30" r="7" fill="currentColor" />
                      <path d="M14 18l8-8h22l6 8H14z" fill="rgba(255,255,255,0.55)" />
                    </svg>
                  </div>
                </div>
                <div className="route-loader-glow" aria-hidden="true" />
              </>
            )}
            <p className="route-loader-text">{t('common.routeLoadingTitle')}</p>
          </div>
        </div>
      )}
      {children}
    </>
  )
}
