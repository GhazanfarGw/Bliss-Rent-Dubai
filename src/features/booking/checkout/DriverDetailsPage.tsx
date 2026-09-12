import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCheckoutContext } from '@/features/booking/checkout/useCheckoutContext'
import { CheckoutLoadGate } from '@/features/booking/checkout/CheckoutLoadGate'
import { CheckoutStepLayout } from '@/features/booking/checkout/CheckoutStepLayout'
import { validateDriverDraft, type DriverFieldErrors } from '@/features/booking/checkout/validation'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { Button, Card, DateField, TextField } from '@/features/shared/ui'
import type { DriverDraft } from '@/types/domain'

/**
 * Step 5 — Driver Details (checkout v2, 2026-09-20). Opens with "Who
 * will drive the car?": choosing "I am the driver" reuses the Step 4
 * customer's name/phone automatically (read-only here, always the
 * CURRENT customer draft — see types/domain.ts's effectiveDriverIdentity
 * — so going back to Step 4 and editing a name can never leave this
 * screen showing something stale); "Someone else will drive" collects
 * that person's own First Name/Last Name/Phone. Either way, the license
 * fields are always collected here — Bliss Rent never supplies a driver.
 */
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
    const fieldErrors = validateDriverDraft(draft.customer, draft.driver, criteria!.endDate)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    navigate(`/checkout/${vehicleId}/summary?${qs}`)
  }

  function handleChange(patch: Partial<DriverDraft>) {
    updateDriver(patch)
    if (touched) setErrors(validateDriverDraft(draft.customer, { ...draft.driver, ...patch }, criteria!.endDate))
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
      <Card>
        <p className="mb-5 text-sm text-text-muted">{t('checkout.driver.intro')}</p>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('checkout.driver.whoDrives')}
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DriverToggleOption
                selected={draft.driver.isSameAsCustomer}
                onSelect={() => handleChange({ isSameAsCustomer: true })}
                label={t('checkout.driver.iAmDriver')}
              />
              <DriverToggleOption
                selected={!draft.driver.isSameAsCustomer}
                onSelect={() => handleChange({ isSameAsCustomer: false })}
                label={t('checkout.driver.someoneElse')}
              />
            </div>
          </fieldset>

          {draft.driver.isSameAsCustomer ? (
            <div className="rounded-lg bg-brand-lavender/40 px-4 py-3 text-sm text-brand-navy">
              <p className="font-semibold">{t('checkout.driver.sameAsCustomerTitle')}</p>
              <p className="mt-1 text-text-muted">
                {draft.customer.firstName || draft.customer.lastName
                  ? `${draft.customer.firstName} ${draft.customer.lastName}`.trim()
                  : t('checkout.driver.sameAsCustomerNoName')}
                {draft.customer.phone ? ` · ${draft.customer.phone}` : ''}
              </p>
              <p className="mt-2 text-xs text-text-muted">{t('checkout.driver.sameAsCustomerHint')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label={t('checkout.driver.firstName')}
                  value={draft.driver.firstName}
                  onChange={(e) => handleChange({ firstName: e.target.value })}
                  placeholder={t('checkout.driver.firstNamePlaceholder')}
                  error={translatedError(errors, 'firstName')}
                  required
                />
                <TextField
                  label={t('checkout.driver.lastName')}
                  value={draft.driver.lastName}
                  onChange={(e) => handleChange({ lastName: e.target.value })}
                  placeholder={t('checkout.driver.lastNamePlaceholder')}
                  error={translatedError(errors, 'lastName')}
                  required
                />
              </div>
              <TextField
                label={t('checkout.driver.phone')}
                type="tel"
                value={draft.driver.phone}
                onChange={(e) => handleChange({ phone: e.target.value })}
                placeholder="+971 5X XXX XXXX"
                error={translatedError(errors, 'phone')}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t('checkout.driver.licenseNumber')}
              value={draft.driver.licenseNumber}
              onChange={(e) => handleChange({ licenseNumber: e.target.value })}
              error={translatedError(errors, 'licenseNumber')}
              required
            />
            <TextField
              label={t('checkout.driver.licenseCountry')}
              value={draft.driver.licenseCountry}
              onChange={(e) => handleChange({ licenseCountry: e.target.value })}
              placeholder={t('checkout.driver.licenseCountryPlaceholder')}
              error={translatedError(errors, 'licenseCountry')}
              required
            />
          </div>
          <DateField
            label={t('checkout.driver.licenseExpiry')}
            value={draft.driver.licenseExpiry}
            onChange={(e) => handleChange({ licenseExpiry: e.target.value })}
            error={translatedError(errors, 'licenseExpiry')}
            required
          />

          <p className="text-xs text-text-muted">{t('checkout.driver.note')}</p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button type="submit" fullWidthOnMobile>
              {t('checkout.driver.continue')}
            </Button>
            <Link
              to={`/checkout/${vehicleId}/customer?${qs}`}
              className="text-sm font-semibold text-text-muted underline hover:text-brand-navy"
            >
              {t('common.back')}
            </Link>
          </div>
        </form>
      </Card>
    </CheckoutStepLayout>
  )
}

function DriverToggleOption({ selected, onSelect, label }: { selected: boolean; onSelect: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={
        'flex items-center gap-3 rounded-lg border px-4 py-3 text-start text-sm font-semibold transition-colors ' +
        (selected
          ? 'border-brand-navy bg-brand-navy text-white'
          : 'border-border bg-white text-brand-navy hover:border-brand-navy/40')
      }
    >
      <span
        aria-hidden="true"
        className={
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ' +
          (selected ? 'border-white' : 'border-border')
        }
      >
        {selected && <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
      {label}
    </button>
  )
}
