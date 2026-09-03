import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabaseClient'
import { useAdminAuth } from '@/features/admin/AdminAuthContext'

export function AdminLoginPage() {
  const { t } = useTranslation()
  const { session, adminProfile, loading, notAuthorized, suspended, signOut, refreshProfile } = useAdminAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/admin'

  if (!loading && session && adminProfile && !suspended) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(t('admin.login.errorInvalid'))
        return
      }
      await refreshProfile()
    } catch {
      setError(t('admin.login.errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-navy px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-navy text-sm font-bold text-white">
            BR
          </span>
          <span className="text-base font-semibold text-brand-navy">{t('nav.brand')}</span>
        </div>
        <h1 className="mt-5 text-xl font-bold text-brand-navy">{t('admin.login.title')}</h1>
        <p className="mt-1 text-sm text-text-muted">{t('admin.login.subtitle')}</p>

        {notAuthorized && (
          <div className="mt-4 rounded-lg border border-error/25 bg-error-bg px-3 py-2 text-sm text-error">
            <p className="font-medium">{t('admin.login.notAuthorized')}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-1 font-semibold underline"
            >
              {t('admin.login.tryDifferentAccount')}
            </button>
          </div>
        )}

        {suspended && (
          <div className="mt-4 rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-sm text-warning">
            <p className="font-medium">{t('admin.login.suspended')}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-1 font-semibold underline"
            >
              {t('admin.login.tryDifferentAccount')}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
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
      </div>
    </div>
  )
}
