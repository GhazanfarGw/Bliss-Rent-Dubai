import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAdminAuth } from '@/features/admin/AdminAuthContext'
import { resetAllTestData } from '@/features/admin/settings/adminSettingsApi'
import {
  fetchExtensionPricingSettings,
  updateExtensionPricingSettings,
  fetchExtensionPenaltySettings,
  updateExtensionPenaltySettings,
} from '@/features/admin/extensions/adminExtensionsApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import type { ExtensionPricingPolicy, ExtensionPenaltyPolicy } from '@/types/database'

type ResetState =
  | { status: 'idle' }
  | { status: 'confirming' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; totalRows: number }

type ExtensionPricingState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; policy: ExtensionPricingPolicy | ''; customDailyRate: string; customCurrency: string }

type ExtensionPenaltyState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'loaded'
      policy: ExtensionPenaltyPolicy | ''
      fixedFeeAmount: string
      perDayAmount: string
      percentageRate: string
      currency: string
    }

export function AdminSettingsPage() {
  const { t } = useTranslation()
  const { adminProfile, session, signOut } = useAdminAuth()
  const [resetState, setResetState] = useState<ResetState>({ status: 'idle' })
  const [confirmText, setConfirmText] = useState('')

  const isSuperAdmin = adminProfile?.role === 'super_admin'

  const [extPricing, setExtPricing] = useState<ExtensionPricingState>({ status: 'loading' })
  const [extPricingSaving, setExtPricingSaving] = useState(false)
  const [extPricingSaved, setExtPricingSaved] = useState(false)
  const [extPricingError, setExtPricingError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSuperAdmin) return
    fetchExtensionPricingSettings()
      .then((s) =>
        setExtPricing({
          status: 'loaded',
          policy: s.policy ?? '',
          customDailyRate: s.custom_daily_rate != null ? String(s.custom_daily_rate) : '',
          customCurrency: s.custom_currency,
        }),
      )
      .catch((err: unknown) => {
        setExtPricing({
          status: 'error',
          message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'),
        })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin])

  async function handleSaveExtensionPricing() {
    if (extPricing.status !== 'loaded' || !extPricing.policy) return
    setExtPricingSaving(true)
    setExtPricingError(null)
    setExtPricingSaved(false)
    try {
      await updateExtensionPricingSettings({
        policy: extPricing.policy,
        customDailyRate: extPricing.policy === 'custom_rate' && extPricing.customDailyRate ? Number(extPricing.customDailyRate) : null,
        customCurrency: extPricing.customCurrency || 'AED',
      })
      setExtPricingSaved(true)
    } catch (err) {
      setExtPricingError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setExtPricingSaving(false)
    }
  }

  const [extPenalty, setExtPenalty] = useState<ExtensionPenaltyState>({ status: 'loading' })
  const [extPenaltySaving, setExtPenaltySaving] = useState(false)
  const [extPenaltySaved, setExtPenaltySaved] = useState(false)
  const [extPenaltyError, setExtPenaltyError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSuperAdmin) return
    fetchExtensionPenaltySettings()
      .then((s) =>
        setExtPenalty({
          status: 'loaded',
          policy: s.policy ?? '',
          fixedFeeAmount: s.fixed_fee_amount != null ? String(s.fixed_fee_amount) : '',
          perDayAmount: s.per_day_amount != null ? String(s.per_day_amount) : '',
          percentageRate: s.percentage_rate != null ? String(s.percentage_rate) : '',
          currency: s.currency,
        }),
      )
      .catch((err: unknown) => {
        setExtPenalty({
          status: 'error',
          message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'),
        })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin])

  async function handleSaveExtensionPenalty() {
    if (extPenalty.status !== 'loaded' || !extPenalty.policy) return
    setExtPenaltySaving(true)
    setExtPenaltyError(null)
    setExtPenaltySaved(false)
    try {
      await updateExtensionPenaltySettings({
        policy: extPenalty.policy,
        fixedFeeAmount: extPenalty.policy === 'fixed_fee' && extPenalty.fixedFeeAmount ? Number(extPenalty.fixedFeeAmount) : null,
        perDayAmount: extPenalty.policy === 'per_day' && extPenalty.perDayAmount ? Number(extPenalty.perDayAmount) : null,
        percentageRate: extPenalty.policy === 'percentage' && extPenalty.percentageRate ? Number(extPenalty.percentageRate) : null,
        currency: extPenalty.currency || 'AED',
      })
      setExtPenaltySaved(true)
    } catch (err) {
      setExtPenaltyError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setExtPenaltySaving(false)
    }
  }

  async function handleReset() {
    setResetState({ status: 'loading' })
    try {
      const counts = await resetAllTestData()
      const totalRows = Object.values(counts).reduce((sum, n) => sum + n, 0)
      setResetState({ status: 'done', totalRows })
      setConfirmText('')
    } catch (err) {
      setResetState({
        status: 'error',
        message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'),
      })
    }
  }

  return (
    <div>
      <AdminPageHeader title={t('admin.nav.settings')} description={t('admin.settings.subtitle')} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
          <h2 className="text-sm font-semibold text-brand-navy">{t('admin.settings.yourProfile')}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted">{t('admin.settings.name')}</dt>
              <dd className="font-medium text-brand-navy">{adminProfile?.full_name ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted">Email</dt>
              <dd className="font-medium text-brand-navy">{session?.user.email ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted">{t('admin.settings.role')}</dt>
              <dd className="font-medium text-brand-navy">{adminProfile ? t(`admin.settings.roles.${adminProfile.role}`) : '—'}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-5 rounded-lg border border-brand-navy/20 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-lavender/30"
          >
            {t('admin.nav.signOut')}
          </button>
        </div>

        {isSuperAdmin && (
          <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
            <h2 className="text-sm font-semibold text-brand-navy">{t('admin.settings.staffDirectory')}</h2>
            <p className="mt-1 text-xs text-text-muted">{t('admin.settings.staffDirectoryNote')}</p>
            <Link
              to="/admin/staff"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark"
            >
              {t('admin.settings.manageStaff')}
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>

      {isSuperAdmin && (
        <div className="mt-5 rounded-2xl border border-brand-navy/10 bg-white p-5">
          <h2 className="text-sm font-semibold text-brand-navy">{t('admin.settings.extensionPricing.title')}</h2>
          <p className="mt-1 text-xs text-text-muted">{t('admin.settings.extensionPricing.subtitle')}</p>

          {extPricing.status === 'loading' && (
            <div className="mt-4 flex justify-center">
              <Spinner className="h-5 w-5" />
            </div>
          )}

          {extPricing.status === 'error' && (
            <div className="mt-4">
              <StateMessage tone="error" title={t('admin.errorGeneric')} body={extPricing.message} />
            </div>
          )}

          {extPricing.status === 'loaded' && (
            <div className="mt-4 space-y-3">
              {!extPricing.policy && (
                <p className="rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-xs text-warning">
                  {t('admin.settings.extensionPricing.notConfigured')}
                </p>
              )}

              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('admin.settings.extensionPricing.policyLabel')}
                </span>
                <select
                  value={extPricing.policy}
                  onChange={(e) => {
                    const policy = e.target.value as ExtensionPricingPolicy | ''
                    setExtPricing((s) => (s.status === 'loaded' ? { ...s, policy } : s))
                    setExtPricingSaved(false)
                  }}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                >
                  <option value="" disabled>
                    {t('admin.settings.extensionPricing.policyOptions.unset')}
                  </option>
                  <option value="original_rate">{t('admin.settings.extensionPricing.policyOptions.original_rate')}</option>
                  <option value="current_rate">{t('admin.settings.extensionPricing.policyOptions.current_rate')}</option>
                  <option value="custom_rate">{t('admin.settings.extensionPricing.policyOptions.custom_rate')}</option>
                </select>
              </label>

              {extPricing.policy === 'custom_rate' && (
                <div className="flex max-w-xs gap-2">
                  <label className="block flex-1">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {t('admin.settings.extensionPricing.customDailyRateLabel')}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={extPricing.customDailyRate}
                      onChange={(e) => {
                        const customDailyRate = e.target.value
                        setExtPricing((s) => (s.status === 'loaded' ? { ...s, customDailyRate } : s))
                        setExtPricingSaved(false)
                      }}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                    />
                  </label>
                  <label className="block w-24">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {t('admin.settings.extensionPricing.customCurrencyLabel')}
                    </span>
                    <input
                      type="text"
                      value={extPricing.customCurrency}
                      onChange={(e) => {
                        const customCurrency = e.target.value
                        setExtPricing((s) => (s.status === 'loaded' ? { ...s, customCurrency } : s))
                        setExtPricingSaved(false)
                      }}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                    />
                  </label>
                </div>
              )}

              {extPricingError && <p className="text-sm font-medium text-error">{extPricingError}</p>}
              {extPricingSaved && !extPricingError && <p className="text-sm font-medium text-success">{t('admin.settings.extensionPricing.saved')}</p>}

              <button
                type="button"
                disabled={!extPricing.policy || extPricingSaving}
                onClick={() => void handleSaveExtensionPricing()}
                className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {extPricingSaving ? t('admin.settings.extensionPricing.saving') : t('admin.settings.extensionPricing.save')}
              </button>
            </div>
          )}
        </div>
      )}

      {isSuperAdmin && (
        <div className="mt-5 rounded-2xl border border-brand-navy/10 bg-white p-5">
          <h2 className="text-sm font-semibold text-brand-navy">{t('admin.settings.extensionPenalty.title')}</h2>
          <p className="mt-1 text-xs text-text-muted">{t('admin.settings.extensionPenalty.subtitle')}</p>

          {extPenalty.status === 'loading' && (
            <div className="mt-4 flex justify-center">
              <Spinner className="h-5 w-5" />
            </div>
          )}

          {extPenalty.status === 'error' && (
            <div className="mt-4">
              <StateMessage tone="error" title={t('admin.errorGeneric')} body={extPenalty.message} />
            </div>
          )}

          {extPenalty.status === 'loaded' && (
            <div className="mt-4 space-y-3">
              {!extPenalty.policy && (
                <p className="rounded-lg border border-warning/30 bg-warning-bg px-3 py-2 text-xs text-warning">
                  {t('admin.settings.extensionPenalty.notConfigured')}
                </p>
              )}

              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('admin.settings.extensionPenalty.policyLabel')}
                </span>
                <select
                  value={extPenalty.policy}
                  onChange={(e) => {
                    const policy = e.target.value as ExtensionPenaltyPolicy | ''
                    setExtPenalty((s) => (s.status === 'loaded' ? { ...s, policy } : s))
                    setExtPenaltySaved(false)
                  }}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                >
                  <option value="" disabled>
                    {t('admin.settings.extensionPenalty.policyOptions.unset')}
                  </option>
                  <option value="fixed_fee">{t('admin.settings.extensionPenalty.policyOptions.fixed_fee')}</option>
                  <option value="per_day">{t('admin.settings.extensionPenalty.policyOptions.per_day')}</option>
                  <option value="percentage">{t('admin.settings.extensionPenalty.policyOptions.percentage')}</option>
                </select>
              </label>

              {extPenalty.policy === 'fixed_fee' && (
                <div className="flex max-w-xs gap-2">
                  <label className="block flex-1">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {t('admin.settings.extensionPenalty.fixedFeeLabel')}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={extPenalty.fixedFeeAmount}
                      onChange={(e) => {
                        const fixedFeeAmount = e.target.value
                        setExtPenalty((s) => (s.status === 'loaded' ? { ...s, fixedFeeAmount } : s))
                        setExtPenaltySaved(false)
                      }}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                    />
                  </label>
                  <label className="block w-24">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {t('admin.settings.extensionPenalty.currencyLabel')}
                    </span>
                    <input
                      type="text"
                      value={extPenalty.currency}
                      onChange={(e) => {
                        const currency = e.target.value
                        setExtPenalty((s) => (s.status === 'loaded' ? { ...s, currency } : s))
                        setExtPenaltySaved(false)
                      }}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                    />
                  </label>
                </div>
              )}

              {extPenalty.policy === 'per_day' && (
                <div className="flex max-w-xs gap-2">
                  <label className="block flex-1">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {t('admin.settings.extensionPenalty.perDayLabel')}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={extPenalty.perDayAmount}
                      onChange={(e) => {
                        const perDayAmount = e.target.value
                        setExtPenalty((s) => (s.status === 'loaded' ? { ...s, perDayAmount } : s))
                        setExtPenaltySaved(false)
                      }}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                    />
                  </label>
                  <label className="block w-24">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {t('admin.settings.extensionPenalty.currencyLabel')}
                    </span>
                    <input
                      type="text"
                      value={extPenalty.currency}
                      onChange={(e) => {
                        const currency = e.target.value
                        setExtPenalty((s) => (s.status === 'loaded' ? { ...s, currency } : s))
                        setExtPenaltySaved(false)
                      }}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                    />
                  </label>
                </div>
              )}

              {extPenalty.policy === 'percentage' && (
                <label className="block max-w-xs">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t('admin.settings.extensionPenalty.percentageLabel')}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={extPenalty.percentageRate}
                    onChange={(e) => {
                      const percentageRate = e.target.value
                      setExtPenalty((s) => (s.status === 'loaded' ? { ...s, percentageRate } : s))
                      setExtPenaltySaved(false)
                    }}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                  />
                </label>
              )}

              {extPenaltyError && <p className="text-sm font-medium text-error">{extPenaltyError}</p>}
              {extPenaltySaved && !extPenaltyError && <p className="text-sm font-medium text-success">{t('admin.settings.extensionPenalty.saved')}</p>}

              <button
                type="button"
                disabled={!extPenalty.policy || extPenaltySaving}
                onClick={() => void handleSaveExtensionPenalty()}
                className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {extPenaltySaving ? t('admin.settings.extensionPenalty.saving') : t('admin.settings.extensionPenalty.save')}
              </button>
            </div>
          )}
        </div>
      )}

      {/*
        TEMPORARY — testing-phase only. Remove this whole section (and
        resetAllTestData() in adminSettingsApi.ts, and the migrations at
        supabase/migrations/20260830000000_admin_reset_test_data.sql and
        supabase/migrations/20260923000000_admin_reset_test_data_keep_vehicles.sql)
        once testing is done and the team goes live with real data.
      */}
      {isSuperAdmin && (
        <div className="mt-5 rounded-2xl border-2 border-error/25 bg-error-bg/50 p-5">
          <h2 className="text-sm font-semibold text-error">{t('admin.settings.dangerZone.title')}</h2>
          <p className="mt-1 text-xs text-error/80">{t('admin.settings.dangerZone.subtitle')}</p>

          {resetState.status !== 'confirming' && resetState.status !== 'done' && (
            <button
              type="button"
              onClick={() => setResetState({ status: 'confirming' })}
              className="mt-4 rounded-lg border border-error/25 bg-white px-4 py-2 text-sm font-semibold text-error hover:bg-error-bg"
            >
              {t('admin.settings.dangerZone.button')}
            </button>
          )}

          {resetState.status === 'confirming' && (
            <div className="mt-4 space-y-3 rounded-lg border border-error/25 bg-white p-4">
              <p className="text-sm text-error">{t('admin.settings.dangerZone.confirmPrompt')}</p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESET"
                className="w-full max-w-xs rounded-lg border border-error/25 bg-white px-3 py-2 text-sm font-mono uppercase tracking-wide text-error outline-none focus:border-error focus:ring-1 focus:ring-error"
                autoComplete="off"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={confirmText.trim().toUpperCase() !== 'RESET'}
                  onClick={() => void handleReset()}
                  className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('admin.settings.dangerZone.confirmButton')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetState({ status: 'idle' })
                    setConfirmText('')
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted hover:bg-surface-muted"
                >
                  {t('admin.settings.dangerZone.cancel')}
                </button>
              </div>
            </div>
          )}

          {resetState.status === 'loading' && (
            <div className="mt-4 flex items-center gap-2 text-sm text-error">
              <Spinner className="h-4 w-4" />
              {t('admin.settings.dangerZone.resetting')}
            </div>
          )}

          {resetState.status === 'error' && (
            <div className="mt-4">
              <StateMessage tone="error" title={t('admin.errorGeneric')} body={resetState.message} />
            </div>
          )}

          {resetState.status === 'done' && (
            <p className="mt-4 rounded-lg border border-success/25 bg-success-bg px-4 py-3 text-sm text-success">
              {t('admin.settings.dangerZone.done', { count: resetState.totalRows })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
