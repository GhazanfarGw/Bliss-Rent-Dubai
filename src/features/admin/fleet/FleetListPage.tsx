import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchVehicles } from '@/features/admin/fleet/adminFleetApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { AdminTabs, type AdminTab } from '@/features/admin/shared/AdminTabs'
import { AdminStatusBadge } from '@/features/admin/shared/AdminStatusBadge'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import { primaryImage } from '@/lib/vehicleImages'
import type { AdminVehicleWithDetails } from '@/types/domain'

type TabValue = 'all' | 'available' | 'reserved' | 'rented' | 'maintenance' | 'unavailable'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; vehicles: AdminVehicleWithDetails[] }

export function FleetListPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabValue>('all')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetchVehicles()
      .then((vehicles) => {
        if (!cancelled) setState({ status: 'loaded', vehicles })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric') })
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const filtered = useMemo(() => {
    if (state.status !== 'loaded') return []
    if (tab === 'all') return state.vehicles
    return state.vehicles.filter((v) => v.operational_status === tab)
  }, [state, tab])

  const counts = useMemo(() => {
    if (state.status !== 'loaded') return {}
    const c: Record<string, number> = {}
    for (const v of state.vehicles) c[v.operational_status] = (c[v.operational_status] ?? 0) + 1
    return c
  }, [state])

  const tabs: AdminTab<TabValue>[] = [
    { value: 'all', label: t('admin.fleet.tabs.all'), count: state.status === 'loaded' ? state.vehicles.length : undefined },
    { value: 'available', label: t('admin.status.available'), count: counts.available },
    { value: 'reserved', label: t('admin.status.reserved'), count: counts.reserved },
    { value: 'rented', label: t('admin.status.rented'), count: counts.rented },
    { value: 'maintenance', label: t('admin.status.maintenance'), count: counts.maintenance },
    { value: 'unavailable', label: t('admin.status.unavailable'), count: counts.unavailable },
  ]

  return (
    <div>
      <AdminPageHeader
        title={t('admin.nav.fleet')}
        description={t('admin.fleet.subtitle')}
        action={
          <Link
            to="/admin/fleet/new"
            className="inline-flex items-center bg-brand-gold px-4 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light"
          >
            {t('admin.fleet.addVehicle')}
          </Link>
        }
      />

      <AdminTabs tabs={tabs} active={tab} onChange={setTab} />

      {state.status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
        </div>
      )}

      {state.status === 'error' && <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />}

      {state.status === 'loaded' && filtered.length === 0 && (
        <StateMessage title={t('admin.fleet.emptyTitle')} body={t('admin.fleet.emptyBody')} />
      )}

      {state.status === 'loaded' && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((v) => (
            <Link
              key={v.id}
              to={`/admin/fleet/${v.id}`}
              className="overflow-hidden rounded-2xl border border-brand-navy/10 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <VehiclePhoto storagePath={primaryImage(v)?.storage_path ?? null} alt={`${v.make} ${v.model}`} className="h-36 w-full" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-brand-navy">
                      {v.make} {v.model}
                    </p>
                    <p className="text-xs text-text-muted">
                      {v.model_year} · {v.plate_number}
                    </p>
                  </div>
                  <AdminStatusBadge status={v.operational_status} />
                </div>
                <p className="mt-2 text-xs text-text-muted">{v.vehicle_categories?.name ?? '—'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
