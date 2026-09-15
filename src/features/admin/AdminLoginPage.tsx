import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabaseClient'
import { useAdminAuth } from '@/features/admin/AdminAuthContext'
import { startAdminLogin, verifyAdminLoginCode, AdminLoginError } from '@/features/admin/adminLoginApi'
import logoMark from '@/assets/brand/logo-mark.png'

type Step =
  | { step: 'credentials' }
  | { step: 'code'; pendingToken: string; maskedEmail: string }

/**
 * Two-step admin sign-in (2026-09-05 — mandatory emailed verification
 * code; owner-confirmed real enforcement, applies to every admin
 * account). Step 1 (email + password) no longer calls
 * supabase.auth.signInWithPassword directly — it calls the
 * admin-login-start Edge Function, which checks the password itself and
 * emails a 6-digit code, but returns only an opaque pendingToken. Step 2
 * (the code) calls admin-login-verify; only once THAT succeeds does this
 * page ever see a real session (accessToken/refreshToken), which it
 * applies with supabase.auth.setSession(). There is no way to reach the
 * dashboard with just the password — see
 * supabase/functions/admin-login-start/logic.ts for the full design.
 */
export function AdminLoginPage() {
  const { t } = useTranslation()
  const { session, adminProfile, loading, notAuthorized, suspended, signOut } = useAdminAuth()
  const location = useLocation()

  const [state, setState] = useState<Step>({ step: 'credentials' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/admin'

  if (!loading && session && adminProfile && !suspended) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await startAdminLogin(email, password)
      setState({ step: 'code', pendingToken: result.pendingToken, maskedEmail: result.maskedEmail })
      setCode('')
    } catch (err) {
      setError(err instanceof AdminLoginError ? err.message : t('admin.login.errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting || state.step !== 'code') return
    setSubmitting(true)
    setError(null)
    try {
      const tokens = await verifyAdminLoginCode(state.pendingToken, code)
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      })
      if (setSessionError) {
        setError(t('admin.login.code.errorGeneric'))
        return
      }
      // AdminAuthContext's onAuthStateChange listener picks this session
      // up and loads admin_profiles on its own — no manual refresh needed.
    } catch (err) {
      setError(err instanceof AdminLoginError ? err.message : t('admin.login.code.errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleStartOver() {
    setState({ step: 'credentials' })
    setPassword('')
    setCode('')
    setError(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-navy px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-2">
          <img src={logoMark} alt="Bliss Rent Dubai" className="h-9 w-auto" />
          <span className="text-base font-semibold text-brand-navy">{t('nav.brand')}</span>
        </div>

        {state.step === 'credentials' ? (
          <>
            <h1 className="mt-5 text-xl font-semibold text-brand-navy">{t('admin.login.title')}</h1>
            <p className="mt-1 text-sm text-text-muted">{t('admin.login.subtitle')}</p>

            {notAuthorized && (
              <div className="mt-4 rounded-lg border border-error/25 bg-error-bg px-3 py-2 text-sm text-error">
                <p className="font-medium">{t('admin.login.notAuthorized')}</p>
                <button type="button" onClick={() => void signOut()} className="mt-1 font-semibold underline">
                  {t('admin.login.tryDifferentAccount')}
                </button>
              </div>
            )}

            {suspended && (
              <div className="mt-4 rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-sm text-warning">
                <p className="font-medium">{t('admin.login.suspended')}</p>
                <button type="button" onClick={() => void signOut()} className="mt-1 font-semibold underline">
                  {t('admin.login.tryDifferentAccount')}
                </button>
              </div>
            )}

            <form onSubmit={(e) => void handleCredentialsSubmit(e)} noValidate className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('admin.login.email')}
                </span>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('admin.login.password')}
                </span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                />
              </label>

              {error && <p className="text-sm font-medium text-error">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-gold-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? t('admin.login.signingIn') : t('admin.login.signIn')}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-text-muted">{t('admin.login.staffOnly')}</p>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-xl font-semibold text-brand-navy">{t('admin.login.code.title')}</h1>
            <p className="mt-1 text-sm text-text-muted">
              {t('admin.login.code.subtitle', { email: state.maskedEmail })}
            </p>

            <form onSubmit={(e) => void handleCodeSubmit(e)} noValidate className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('admin.login.code.label')}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-center text-lg font-semibold tracking-[0.3em] text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                />
              </label>

              {error && <p className="text-sm font-medium text-error">{error}</p>}

              <button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="w-full rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-gold-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? t('admin.login.code.verifying') : t('admin.login.code.verifyButton')}
              </button>

              <button
                type="button"
                onClick={handleStartOver}
                className="w-full text-center text-sm font-semibold text-brand-navy underline"
              >
                {t('admin.login.code.startOver')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
