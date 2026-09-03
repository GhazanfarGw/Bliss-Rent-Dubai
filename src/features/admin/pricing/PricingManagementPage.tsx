import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchVehicles } from '@/features/admin/fleet/adminFleetApi'
import { buildPricingDrafts, savePricingLadder } from '@/features/admin/pricing/adminPricingApi'
import { validatePricingDrafts, type PricingFieldErrors } from '@/features/admin/pricing/pricingValidation'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import { TERM_LABELS } from '@/lib/pricing'
import type { AdminVehicleWithDetails, PricingDraft } from '@/types/domain'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; vehicles: AdminVehicleWithDetails[] }

export function PricingManagementPage() {
  const { t } = useTranslation()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [vehicleId, setVehicleId] = useState<string>('')
  const [drafts, setDrafts] = useState<PricingDraft[]>([])
  const [errors, setErrors] = useState<PricingFieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchVehicles()
      .then((vehicles) => {
        if (cancelled) return
        setState({ status: 'loaded', vehicles })
        if (vehicles.length > 0) {
          setVehicleId(vehicles[0].id)
          setDrafts(buildPricingDrafts(vehicles[0].pricing))
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric') })
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const vehicles = state.status === 'loaded' ? state.vehicles : []
  const selectedVehicle = useMemo(() => vehicles.find((v) => v.id === vehicleId) ?? null, [vehicles, vehicleId])

  function handleSelectVehicle(id: string) {
    setVehicleId(id)
    const v = vehicles.find((x) => x.id === id)
    setDrafts(buildPricingDrafts(v?.pricing ?? []))
    setErrors({})
    setSaved(false)
    setSaveError(null)
  }

  function handleDraftChange(term: PricingDraft['term'], field: 'listPrice' | 'clientPrice', value: string) {
    setDrafts((prev) => prev.map((d) => (d.term === term ? { ...d, [field]: value } : d)))
    setSaved(false)
  }

  async function handleSave() {
    if (!vehicleId || saving) return
    const fieldErrors = validatePricingDrafts(drafts)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      await savePricingLadder(vehicleId, drafts)
      const refreshed = await fetchVehicles()
      if (state.status === 'loaded') setState({ status: 'loaded', vehicles: refreshed })
      const v = refreshed.find((x) => x.id === vehicleId)
      setDrafts(buildPricingDrafts(v?.pricing ?? []))
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setSaving(false)
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Spinner className="h-8 w-8" />
        <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />
  }

  return (
    <div>
      <AdminPageHeader title={t('admin.nav.pricing')} description={t('admin.pricing.subtitle')} />

      {vehicles.length === 0 ? (
        <StateMessage title={t('admin.pricing.emptyTitle')} body={t('admin.pricing.emptyBody')} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-brand-navy/10 bg-white p-5 lg:col-span-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('admin.pricing.selectVehicle')}
            </label>
            <select
              value={vehicleId}
              onChange={(e) => handleSelectVehicle(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm text-brand-navy outline-none focus:border-brand-navy"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.make} {v.model} ({v.model_year}) · {v.plate_number}
                </option>
              ))}
            </select>
            {selectedVehicle && (
              <p className="mt-3 text-xs text-text-muted">{selectedVehicle.vehicle_categories?.name ?? '—'}</p>
            )}
          </div>

          <div className="rounded-2xl border border-brand-navy/10 bg-white p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-brand-navy">{t('admin.pricing.ladder')}</h2>

            <div className="mt-4 space-y-4">
              {drafts.map((d) => (
                <div key={d.term} className="grid grid-cols-1 items-end gap-3 border-b border-brand-navy/5 pb-4 last:border-0 last:pb-0 sm:grid-cols-3">
                  <div className="text-sm font-medium text-brand-navy">{TERM_LABELS[d.term]}</div>
                  <div>
                    <label className="mb-1 block text-xs text-text-muted">{t('admin.pricing.listPrice')}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={d.listPrice}
                      onChange={(e) => handleDraftChange(d.term, 'listPrice', e.target.value)}
                      className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm text-brand-navy outline-none focus:border-brand-navy"
                    />
                    {errors[`${d.term}.listPrice`] && <p className="mt-1 text-xs text-error">{errors[`${d.term}.listPrice`]}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-text-muted">{t('admin.pricing.clientPrice')}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={d.clientPrice}
                      onChange={(e) => handleDraftChange(d.term, 'clientPrice', e.target.value)}
                      className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm text-brand-navy outline-none focus:border-brand-navy"
                    />
                    {errors[`${d.term}.clientPrice`] && <p className="mt-1 text-xs text-error">{errors[`${d.term}.clientPrice`]}</p>}
                  </div>
                </div>
              ))}
            </div>

            {saveError && (
              <div className="mt-4 rounded-lg border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{saveError}</div>
            )}
            {saved && !saveError && (
              <div className="mt-4 rounded-lg border border-success/25 bg-success-bg px-4 py-3 text-sm text-success">
                {t('admin.pricing.saved')}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="mt-4 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t('common.loading') : t('admin.pricing.saveChanges')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
