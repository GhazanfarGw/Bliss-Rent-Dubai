import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCheckoutContext } from '@/features/booking/checkout/useCheckoutContext'
import { CheckoutLoadGate } from '@/features/booking/checkout/CheckoutLoadGate'
import { CheckoutStepLayout } from '@/features/booking/checkout/CheckoutStepLayout'
import { validateCustomerDraft, type CustomerFieldErrors } from '@/features/booking/checkout/validation'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import type { CustomerDraft } from '@/types/domain'

export function CustomerDetailsPage() {
  const { t } = useTranslation()
  const { id: vehicleId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { loadState, vehicle, errorMessage, criteria, pickup, dropoff, draft, updateCustomer } =
    useCheckoutContext(vehicleId)
  const [errors, setErrors] = useState<CustomerFieldErrors>({})
  const [touched, setTouched] = useState(false)

  if (loadState !== 'ready' || !vehicle || !criteria) {
    return <CheckoutLoadGate loadState={loadState} vehicleId={vehicleId} errorMessage={errorMessage} />
  }

  // validateCustomerDraft's returned message text is English-only and
  // UX-only (see that module's comment) — we use only its field-name
  // keys here and look up the translated message ourselves, so the
  // pure validation module stays untouched and unilingual.
  function translatedError(fieldErrors: CustomerFieldErrors, field: keyof CustomerFieldErrors) {
    return fieldErrors[field] ? t(`checkout.customer.errors.${field}`) : undefined
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    const fieldErrors = validateCustomerDraft(draft.customer)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    navigate(`/checkout/${vehicleId}/driver?${criteriaToSearchParams(criteria!).toString()}`)
  }

  function handleChange(patch: Partial<CustomerDraft>) {
    updateCustomer(patch)
    if (touched) setErrors(validateCustomerDraft({ ...draft.customer, ...patch }))
  }

  return (
    <CheckoutStepLayout
      stepIndex={0}
      title={t('checkout.customer.title')}
      vehicle={vehicle}
      startDate={criteria.startDate}
      endDate={criteria.endDate}
      pickup={pickup}
      dropoff={dropoff}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-brand-navy/10 bg-white p-5">
        <Field label={t('checkout.customer.fullName')} error={translatedError(errors, 'fullName')}>
          <input
            type="text"
            value={draft.customer.fullName}
            onChange={(e) => handleChange({ fullName: e.target.value })}
            className={inputClass}
            placeholder={t('checkout.customer.fullNamePlaceholder')}
            autoComplete="name"
          />
        </Field>
        <Field label={t('checkout.customer.email')} error={translatedError(errors, 'email')}>
          <input
            type="email"
            value={draft.customer.email}
            onChange={(e) => handleChange({ email: e.target.value })}
            className={inputClass}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>
        <Field label={t('checkout.customer.phone')} error={translatedError(errors, 'phone')}>
          <input
            type="tel"
            value={draft.customer.phone}
            onChange={(e) => handleChange({ phone: e.target.value })}
            className={inputClass}
            placeholder="+971 5X XXX XXXX"
            autoComplete="tel"
          />
        </Field>

        <p className="text-xs text-text-muted">{t('checkout.customer.note')}</p>

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-light sm:w-auto"
        >
          {t('checkout.customer.continue')}
        </button>
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
