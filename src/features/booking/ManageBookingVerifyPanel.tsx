import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Hash, UserRound, ShieldCheck } from 'lucide-react'
import { Button } from '@/features/shared/ui/Button'
import { inputClass } from '@/features/shared/ui/inputClasses'
import { lookupBooking, BookingLookupError } from '@/features/booking/lookupApi'
import { lastNameMatches } from '@/features/booking/manageBookingVerify'

type Status = 'idle' | 'verifying'

/**
 * Phase 11 correction — the homepage navigator's Manage Booking tab.
 * Unlike the /manage-booking page's own single-field lookup (reference OR
 * plate — see lookupApi.ts for that deliberate trade-off), this panel asks
 * for the Booking Reference AND Last Name together, per the corrected
 * spec. It still calls the SAME authoritative `lookupBooking()` RPC — no
 * second verification algorithm — and only adds a client-side last-name
 * check against the `customerName` that call already returns (see
 * manageBookingVerify.ts). On success it hands off to the existing
 * ManageBookingPage via router state, so every downstream behavior
 * (booking summary, Extend Rental, Continue to Payment) is the untouched,
 * already-shipped implementation — never duplicated here.
 */
export function ManageBookingVerifyPanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [reference, setReference] = useState('')
  const [lastName, setLastName] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!reference.trim() || !lastName.trim()) {
      setError(t('home.navigator.manage.errorRequired'))
      return
    }

    setStatus('verifying')
    setError(null)
    try {
      const result = await lookupBooking(reference)
      if (result && lastNameMatches(result.customerName, lastName)) {
        navigate('/manage-booking', { state: { prefetchedResult: result } })
        return
      }
      // Deliberately the same generic message whether the reference doesn't
      // exist or the last name doesn't match it — never reveal which.
      setStatus('idle')
      setError(t('home.navigator.manage.errorNotFound'))
    } catch (err) {
      setStatus('idle')
      setError(err instanceof BookingLookupError ? err.message : t('home.navigator.manage.errorGeneric'))
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-black tracking-[-0.04em] text-brand-navy sm:text-3xl">{t('home.navigator.manage.heading')}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-text-muted">{t('home.navigator.manage.intro')}</p>

      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('home.navigator.manage.referenceLabel')}
          </span>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={t('home.navigator.manage.referencePlaceholder')}
            className={inputClass()}
            autoComplete="off"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('home.navigator.manage.lastNameLabel')}
          </span>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t('home.navigator.manage.lastNamePlaceholder')}
            className={inputClass()}
            autoComplete="family-name"
          />
        </label>

        <div className="sm:col-span-2">
          <Button type="submit" loading={status === 'verifying'} fullWidthOnMobile>
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            {status === 'verifying' ? t('home.navigator.manage.verifying') : t('home.navigator.manage.submit')}
          </Button>
        </div>

        {error && (
          <p className="rounded-2xl border border-error/25 bg-error-bg px-4 py-3 text-sm text-error sm:col-span-2">{error}</p>
        )}
      </form>
    </div>
  )
}
