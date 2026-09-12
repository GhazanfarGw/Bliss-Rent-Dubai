import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCheckoutContext } from '@/features/booking/checkout/useCheckoutContext'
import { CheckoutLoadGate } from '@/features/booking/checkout/CheckoutLoadGate'
import { CheckoutStepLayout } from '@/features/booking/checkout/CheckoutStepLayout'
import { validateCustomerDraft, type CustomerFieldErrors } from '@/features/booking/checkout/validation'
import { criteriaToSearchParams } from '@/features/booking/searchParams'
import { Button, Card, TextField } from '@/features/shared/ui'
import type { CustomerDraft } from '@/types/domain'

/**
 * Step 4 — Customer Details (checkout v2, 2026-09-20). Deliberately just
 * four fields: First Name, Last Name, Email, Phone/WhatsApp — the brief's
 * own words are "clean and quick to complete, do not ask for unnecessary
 * information", so nothing else lives here any more (no separate
 * "optional" phone — it's required, since it's one of only four fields).
 */
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
      <Card>
        <p className="mb-5 text-sm text-text-muted">{t('checkout.customer.note')}</p>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label={t('checkout.customer.firstName')}
              value={draft.customer.firstName}
              onChange={(e) => handleChange({ firstName: e.target.value })}
              placeholder={t('checkout.customer.firstNamePlaceholder')}
              autoComplete="given-name"
              error={translatedError(errors, 'firstName')}
              required
            />
            <TextField
              label={t('checkout.customer.lastName')}
              value={draft.customer.lastName}
              onChange={(e) => handleChange({ lastName: e.target.value })}
              placeholder={t('checkout.customer.lastNamePlaceholder')}
              autoComplete="family-name"
              error={translatedError(errors, 'lastName')}
              required
            />
          </div>

          <TextField
            label={t('checkout.customer.email')}
            type="email"
            value={draft.customer.email}
            onChange={(e) => handleChange({ email: e.target.value })}
            placeholder="you@example.com"
            autoComplete="email"
            error={translatedError(errors, 'email')}
            required
          />

          <TextField
            label={t('checkout.customer.phone')}
            type="tel"
            value={draft.customer.phone}
            onChange={(e) => handleChange({ phone: e.target.value })}
            placeholder="+971 5X XXX XXXX"
            autoComplete="tel"
            error={translatedError(errors, 'phone')}
            hint={t('checkout.customer.phoneHint')}
            required
          />

          <div className="pt-2">
            <Button type="submit" fullWidthOnMobile>
              {t('checkout.customer.continue')}
            </Button>
          </div>
        </form>
      </Card>
    </CheckoutStepLayout>
  )
}
