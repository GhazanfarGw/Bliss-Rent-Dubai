import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { prefersReducedMotion } from '@/lib/motion'
import { Spinner } from '@/features/shared/StateMessage'

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
            <Spinner className="h-7 w-7" />
            <p className="route-loader-text">{t('common.routeLoadingTitle')}</p>
          </div>
        </div>
      )}
      {children}
    </>
  )
}
