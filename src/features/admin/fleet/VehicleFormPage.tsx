import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import {
  fetchCategories,
  fetchVehicleById,
  createVehicle,
  updateVehicle,
  uploadVehicleImage,
  setPrimaryImage,
  deleteVehicleImage,
  deleteVehicle,
} from '@/features/admin/fleet/adminFleetApi'
import { validateVehicleDraft, type VehicleFieldErrors } from '@/features/admin/fleet/vehicleValidation'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { VehiclePhoto } from '@/features/booking/VehiclePhoto'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import { EMPTY_VEHICLE_DRAFT, type AdminVehicleWithDetails, type VehicleDraft } from '@/types/domain'
import type { Database } from '@/types/database'

type CategoryRow = Database['public']['Tables']['vehicle_categories']['Row']
type VehicleStatus = Database['public']['Tables']['vehicles']['Row']['status']

const STATUS_OPTIONS: VehicleStatus[] = ['available', 'maintenance', 'retired']

function vehicleToDraft(v: AdminVehicleWithDetails): VehicleDraft {
  return {
    categoryId: v.category_id,
    make: v.make,
    model: v.model,
    modelYear: String(v.model_year),
    transmission: v.transmission,
    seats: String(v.seats),
    plateNumber: v.plate_number,
    status: v.status,
    engine: v.engine ?? '',
    horsepower: v.horsepower == null ? '' : String(v.horsepower),
    torqueNm: v.torque_nm == null ? '' : String(v.torque_nm),
    topSpeedKmh: v.top_speed_kmh == null ? '' : String(v.top_speed_kmh),
    acceleration0100: v.acceleration_0_100 == null ? '' : String(v.acceleration_0_100),
    fuelType: v.fuel_type ?? '',
    fuelConsumptionL100km: v.fuel_consumption_l100km == null ? '' : String(v.fuel_consumption_l100km),
    drivetrain: v.drivetrain ?? '',
    doors: v.doors == null ? '' : String(v.doors),
    originCountry: v.origin_country ?? '',
    about: v.about ?? '',
    aboutAr: v.about_ar ?? '',
  }
}

export function VehicleFormPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [vehicle, setVehicle] = useState<AdminVehicleWithDetails | null>(null)
  const [draft, setDraft] = useState<VehicleDraft>(EMPTY_VEHICLE_DRAFT)
  const [errors, setErrors] = useState<VehicleFieldErrors>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const cats = await fetchCategories()
      setCategories(cats)
      if (id) {
        const v = await fetchVehicleById(id)
        if (!v) {
          setLoadError(t('admin.fleet.notFound'))
        } else {
          setVehicle(v)
          setDraft(vehicleToDraft(v))
        }
      } else if (cats.length > 0) {
        setDraft((d) => ({ ...d, categoryId: cats[0].id }))
      }
    } catch (err) {
      setLoadError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const fieldErrors = validateVehicleDraft(draft)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setSaving(true)
    setSaveError(null)
    try {
      if (isEdit && id) {
        await updateVehicle(id, draft)
        navigate(`/admin/fleet/${id}`)
      } else {
        const newId = await createVehicle(draft)
        navigate(`/admin/fleet/${newId}`)
      }
    } catch (err) {
      setSaveError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setSaving(false)
    }
  }

  async function handleImageSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setImageBusy(true)
    setImageError(null)
    try {
      await uploadVehicleImage(id, file, (vehicle?.vehicle_images.length ?? 0) === 0)
      await load()
    } catch (err) {
      setImageError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setImageBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSetPrimary(imageId: string) {
    if (!id) return
    setImageBusy(true)
    setImageError(null)
    try {
      await setPrimaryImage(id, imageId)
      await load()
    } catch (err) {
      setImageError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setImageBusy(false)
    }
  }

  async function handleDeleteVehicle() {
    if (!id || !vehicle) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteVehicle(
        id,
        vehicle.vehicle_images.map((img) => img.storage_path),
      )
      navigate('/admin/fleet')
    } catch (err) {
      setDeleteError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  async function handleDeleteImage(imageId: string, storagePath: string) {
    setImageBusy(true)
    setImageError(null)
    try {
      await deleteVehicleImage(imageId, storagePath)
      await load()
    } catch (err) {
      setImageError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setImageBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Spinner className="h-8 w-8" />
        <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <StateMessage
        tone="error"
        title={t('admin.errorGeneric')}
        body={loadError}
        action={
          <Link to="/admin/fleet" className="text-sm font-semibold text-brand-navy underline">
            {t('admin.fleet.backToList')}
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <button type="button" onClick={() => navigate('/admin/fleet')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-brand-navy">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('admin.fleet.backToList')}
      </button>

      <AdminPageHeader title={isEdit ? t('admin.fleet.editTitle') : t('admin.fleet.addTitle')} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-brand-navy/10 bg-white p-5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('admin.fleet.fields.make')} error={errors.make}>
              <input value={draft.make} onChange={(e) => setDraft({ ...draft, make: e.target.value })} className={inputClass} />
            </Field>
            <Field label={t('admin.fleet.fields.model')} error={errors.model}>
              <input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} className={inputClass} />
            </Field>
            <Field label={t('admin.fleet.fields.modelYear')} error={errors.modelYear}>
              <input
                type="number"
                value={draft.modelYear}
                onChange={(e) => setDraft({ ...draft, modelYear: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t('admin.fleet.fields.category')} error={errors.categoryId}>
              <select value={draft.categoryId} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })} className={inputClass}>
                <option value="">{t('admin.fleet.fields.selectCategory')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('admin.fleet.fields.transmission')}>
              <select
                value={draft.transmission}
                onChange={(e) => setDraft({ ...draft, transmission: e.target.value })}
                className={inputClass}
              >
                <option value="automatic">{t('admin.fleet.fields.automatic')}</option>
                <option value="manual">{t('admin.fleet.fields.manual')}</option>
              </select>
            </Field>
            <Field label={t('admin.fleet.fields.seats')} error={errors.seats}>
              <input type="number" value={draft.seats} onChange={(e) => setDraft({ ...draft, seats: e.target.value })} className={inputClass} />
            </Field>
            <Field label={t('admin.fleet.fields.plateNumber')} error={errors.plateNumber}>
              <input value={draft.plateNumber} onChange={(e) => setDraft({ ...draft, plateNumber: e.target.value })} className={inputClass} />
            </Field>
            <Field label={t('admin.fleet.fields.status')}>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as VehicleStatus })}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`admin.status.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="border-t border-brand-navy/10 pt-5">
            <h2 className="text-sm font-semibold text-brand-navy">{t('admin.fleet.fields.specsTitle')}</h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">{t('admin.fleet.fields.specsHint')}</p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label={t('admin.fleet.fields.engine')}>
                  <input value={draft.engine} onChange={(e) => setDraft({ ...draft, engine: e.target.value })} className={inputClass} />
                </Field>
              </div>
              <NumberField label={t('admin.fleet.fields.horsepower')} field="horsepower" draft={draft} setDraft={setDraft} errors={errors} />
              <NumberField label={t('admin.fleet.fields.torqueNm')} field="torqueNm" draft={draft} setDraft={setDraft} errors={errors} />
              <NumberField label={t('admin.fleet.fields.topSpeedKmh')} field="topSpeedKmh" draft={draft} setDraft={setDraft} errors={errors} />
              <NumberField label={t('admin.fleet.fields.acceleration0100')} field="acceleration0100" step="0.1" draft={draft} setDraft={setDraft} errors={errors} />
              <Field label={t('admin.fleet.fields.fuelType')}>
                <input value={draft.fuelType} onChange={(e) => setDraft({ ...draft, fuelType: e.target.value })} className={inputClass} />
              </Field>
              <NumberField label={t('admin.fleet.fields.fuelConsumptionL100km')} field="fuelConsumptionL100km" step="0.1" draft={draft} setDraft={setDraft} errors={errors} />
              <Field label={t('admin.fleet.fields.drivetrain')}>
                <select value={draft.drivetrain} onChange={(e) => setDraft({ ...draft, drivetrain: e.target.value })} className={inputClass}>
                  <option value="">{t('admin.fleet.fields.drivetrainNone')}</option>
                  {['RWD', 'FWD', 'AWD', '4WD'].map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </Field>
              <NumberField label={t('admin.fleet.fields.doors')} field="doors" draft={draft} setDraft={setDraft} errors={errors} />
              <div className="sm:col-span-2">
                <Field label={t('admin.fleet.fields.originCountry')}>
                  <input value={draft.originCountry} onChange={(e) => setDraft({ ...draft, originCountry: e.target.value })} className={inputClass} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label={t('admin.fleet.fields.about')}>
                  <textarea rows={5} value={draft.about} onChange={(e) => setDraft({ ...draft, about: e.target.value })} className={inputClass} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label={t('admin.fleet.fields.aboutAr')}>
                  <textarea rows={5} dir="rtl" value={draft.aboutAr} onChange={(e) => setDraft({ ...draft, aboutAr: e.target.value })} className={inputClass} />
                </Field>
              </div>
            </div>
          </div>

          {saveError && <p className="text-sm font-medium text-error">{saveError}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-navy px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-light disabled:opacity-60"
          >
            {saving ? t('common.loading') : isEdit ? t('admin.fleet.save') : t('admin.fleet.create')}
          </button>

          {isEdit && (
            <div className="border-t border-error/20 pt-4">
              {!confirmingDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-lg border border-error/25 px-4 py-2 text-sm font-semibold text-error transition-colors hover:bg-error-bg"
                >
                  {t('admin.fleet.deleteVehicle')}
                </button>
              ) : (
                <div className="space-y-3 rounded-lg border border-error/25 bg-error-bg/50 p-4">
                  <p className="text-sm text-error">{t('admin.fleet.deleteConfirmPrompt', { make: draft.make, model: draft.model })}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void handleDeleteVehicle()}
                      className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deleting ? t('admin.fleet.deleting') : t('admin.fleet.deleteConfirmButton')}
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setConfirmingDelete(false)}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted hover:bg-surface-muted"
                    >
                      {t('admin.fleet.deleteCancel')}
                    </button>
                  </div>
                </div>
              )}
              {deleteError && <p className="mt-2 text-sm font-medium text-error">{deleteError}</p>}
            </div>
          )}
        </form>

        <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
          <h2 className="text-sm font-semibold text-brand-navy">{t('admin.fleet.images')}</h2>
          {!isEdit ? (
            <p className="mt-2 text-xs text-text-muted">{t('admin.fleet.imagesAfterCreate')}</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(vehicle?.vehicle_images ?? []).map((img) => (
                  <div key={img.id} className="relative overflow-hidden rounded-lg border border-brand-navy/10">
                    <VehiclePhoto storagePath={img.storage_path} alt="" className="h-20 w-full" />
                    {img.is_primary && (
                      <span className="absolute start-1 top-1 rounded bg-brand-gold px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {t('admin.fleet.primary')}
                      </span>
                    )}
                    <div className="flex items-center justify-between bg-white/90 px-1.5 py-1 text-[10px]">
                      {!img.is_primary && (
                        <button type="button" onClick={() => void handleSetPrimary(img.id)} className="font-semibold text-brand-navy underline">
                          {t('admin.fleet.makePrimary')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDeleteImage(img.id, img.storage_path)}
                        className="font-semibold text-error underline"
                      >
                        {t('admin.fleet.remove')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void handleImageSelected(e)}
                className="sr-only"
                disabled={imageBusy}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageBusy}
                className="mt-3 rounded-lg border border-brand-navy px-4 py-2 text-xs font-semibold text-brand-navy transition-colors hover:bg-brand-navy hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {imageBusy ? t('admin.fleet.uploading') : t('admin.fleet.addPhoto')}
              </button>
              {imageError && <p className="mt-2 text-xs font-medium text-error">{imageError}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** One optional numeric specification input; blank means "not entered". */
function NumberField({
  label,
  field,
  step,
  draft,
  setDraft,
  errors,
}: {
  label: string
  field: 'horsepower' | 'torqueNm' | 'topSpeedKmh' | 'acceleration0100' | 'fuelConsumptionL100km' | 'doors'
  step?: string
  draft: VehicleDraft
  setDraft: (draft: VehicleDraft) => void
  errors: VehicleFieldErrors
}) {
  return (
    <Field label={label} error={errors[field]}>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={draft[field]}
        onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
        className={inputClass}
      />
    </Field>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-error">{error}</span>}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-brand-navy outline-none transition-colors focus:border-brand-navy focus:ring-1 focus:ring-brand-navy'
