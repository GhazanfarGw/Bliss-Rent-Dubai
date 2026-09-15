import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { buttonClass } from '@/features/shared/ui/buttonClasses'

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Top-level render-error safety net. Before this, any uncaught error
 * anywhere in the component tree (a bad API response shape, a null
 * dereference, a third-party script issue) crashed to a completely blank
 * white page with no way back except manually retyping the URL — there was
 * no error boundary anywhere in the app. This wraps <App/> in main.tsx, so
 * it catches everything below the router too; a plain <a href="/"> (not
 * react-router's Link) is used in the fallback since BrowserRouter itself
 * is inside the boundary and is unmounted along with everything else once
 * it trips.
 *
 * Deliberately generic: it doesn't attempt to guess *why* something broke
 * (no fabricated error explanation), just offers the two real recovery
 * paths — reload, or go home — plus the real support channel already used
 * everywhere else in the app.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Unhandled render error caught by ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    return this.props.children
  }
}

function ErrorFallback() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-lavender/40 px-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-none bg-error-bg">
        <AlertTriangle className="h-7 w-7 text-error" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold text-brand-navy sm:text-3xl">{t('errorBoundary.title')}</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-text-muted">{t('errorBoundary.body')}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => window.location.reload()} className={buttonClass({ variant: 'primary' })}>
          {t('errorBoundary.reload')}
        </button>
        <a href="/" className={buttonClass({ variant: 'secondary' })}>
          {t('errorBoundary.backHome')}
        </a>
      </div>
    </div>
  )
}
