import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import type { CheckoutLoadState } from '@/features/booking/checkout/useCheckoutContext'

interface CheckoutLoadGateProps {
  loadState: CheckoutLoadState
  vehicleId: string | undefined
  errorMessage: string | null
}

/**
 * The same four non-"ready" states can happen on every checkout step
 * (missing/invalid dates in the URL, vehicle not found, a fetch error,
 * still loading) — one shared gate instead of repeating this per page.
 */
export function CheckoutLoadGate({ loadState, vehicleId, errorMessage }: CheckoutLoadGateProps) {
  const { t } = useTranslation()

  if (loadState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
        <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
      </div>
    )
  }

  if (loadState === 'missing_criteria') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <StateMessage
          title={t('checkout.missingCriteriaTitle')}
          body={t('checkout.missingCriteriaBody')}
          action={
            <Link
              to={vehicleId ? `/vehicles/${vehicleId}` : '/search'}
              className="text-sm font-semibold text-brand-navy underline"
            >
              {t('checkout.backToVehicle')}
            </Link>
          }
        />
      </div>
    )
  }

  if (loadState === 'not_found') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <StateMessage
          title={t('checkout.notFoundTitle')}
          body={t('checkout.notFoundBody')}
          action={
            <Link to="/search" className="text-sm font-semibold text-brand-navy underline">
              {t('checkout.backToSearch')}
            </Link>
          }
        />
      </div>
    )
  }

  // 'error'
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <StateMessage
        tone="error"
        title={t('checkout.errorTitle')}
        body={errorMessage ?? t('checkout.errorGeneric', { defaultValue: 'Please try again in a moment.' })}
        action={
          <Link to={vehicleId ? `/vehicles/${vehicleId}` : '/search'} className="text-sm font-semibold text-brand-navy underline">
            {t('checkout.backToVehicle')}
          </Link>
        }
      />
    </div>
  )
}
