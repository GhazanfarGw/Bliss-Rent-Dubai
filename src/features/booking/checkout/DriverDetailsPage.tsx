import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCheckoutContext } from '@/features/booking/checkout/useCheckoutContext'
import { CheckoutLoadGate } from '@/features/booking/checkout/CheckoutLoadGate'
import { CheckoutStepLayout } from '@/features/booking/checkout/CheckoutStepLayout'
import { validateDriverDraft, type DriverFieldErrors } from '@/features/booking/checkout/validation'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import type { DriverDraft } from '@/types/domain'

export function DriverDetailsPage() {
  const { t } = useTranslation()
  const { id: vehicleId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { loadState, vehicle, errorMessage, criteria, pickup, dropoff, draft, updateDriver } =
    useCheckoutContext(vehicleId)
  const [errors, setErrors] = useState<DriverFieldErrors>({})
  const [touched, setTouched] = useState(false)

  if (loadState !== 'ready' || !vehicle || !criteria) {
    return <CheckoutLoadGate loadState={loadState} vehicleId={vehicleId} errorMessage={errorMessage} />
  }

  const qs = criteriaToSearchParams(criteria).toString()

  // See CustomerDetailsPage's comment: validateDriverDraft's own message
  // text stays English/UX-only; we translate by field-name key instead.
  function translatedError(fieldErrors: DriverFieldErrors, field: keyof DriverFieldErrors) {
    return fieldErrors[field] ? t(`checkout.driver.errors.${field}`) : undefined
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    const fieldErrors = validateDriverDraft(draft.driver, criteria!.startDate, criteria!.endDate)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    navigate(`/checkout/${vehicleId}/summary?${qs}`)
  }

  function handleChange(patch: Partial<DriverDraft>) {
    updateDriver(patch)
    if (touched) setErrors(validateDriverDraft({ ...draft.driver, ...patch }, criteria!.startDate, criteria!.endDate))
  }

  return (
    <CheckoutStepLayout
      stepIndex={1}
      title={t('checkout.driver.title')}
      vehicle={vehicle}
      startDate={criteria.startDate}
      endDate={criteria.endDate}
      pickup={pickup}
      dropoff={dropoff}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-brand-navy/10 bg-white p-5">
        <p className="rounded-lg bg-brand-lavender/50 px-3 py-2 text-xs text-brand-navy/80">
          {t('checkout.driver.intro')}
        </p>

        <Field label={t('checkout.driver.fullName')} error={translatedError(errors, 'fullName')}>
          <input
            type="text"
            value={draft.driver.fullName}
            onChange={(e) => handleChange({ fullName: e.target.value })}
            className={inputClass}
            placeholder={t('checkout.driver.fullNamePlaceholder')}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('checkout.driver.dateOfBirth')} error={translatedError(errors, 'dateOfBirth')}>
            <input
              type="date"
              value={draft.driver.dateOfBirth}
              onChange={(e) => handleChange({ dateOfBirth: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t('checkout.driver.licenseExpiry')} error={translatedError(errors, 'licenseExpiry')}>
            <input
              type="date"
              value={draft.driver.licenseExpiry}
              onChange={(e) => handleChange({ licenseExpiry: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('checkout.driver.licenseNumber')} error={translatedError(errors, 'licenseNumber')}>
            <input
              type="text"
              value={draft.driver.licenseNumber}
              onChange={(e) => handleChange({ licenseNumber: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t('checkout.driver.licenseCountry')} error={translatedError(errors, 'licenseCountry')}>
            <input
              type="text"
              value={draft.driver.licenseCountry}
              onChange={(e) => handleChange({ licenseCountry: e.target.value })}
              className={inputClass}
              placeholder={t('checkout.driver.licenseCountryPlaceholder')}
            />
          </Field>
        </div>

        <p className="text-xs text-text-muted">{t('checkout.driver.note')}</p>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="rounded-lg bg-brand-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-light"
          >
            {t('checkout.driver.continue')}
          </button>
          <Link
            to={`/checkout/${vehicleId}/customer?${qs}`}
            className="text-sm font-semibold text-text-muted underline hover:text-brand-navy"
          >
            {t('common.back')}
          </Link>
        </div>
      </form>
    </CheckoutStepLayout>
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
