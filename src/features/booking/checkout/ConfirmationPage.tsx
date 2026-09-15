import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BadgeCheck } from 'lucide-react'
import { readConfirmationSnapshot } from '@/features/booking/checkout/checkoutStorage'
import { StateMessage } from '@/features/shared/StateMessage'

/**
 * Guest checkout has no auth session, so this page can't re-fetch the
 * booking from Supabase (RLS would return nothing for an anonymous
 * visitor — see the Phase 2 migration comment). Instead it reads the
 * snapshot captured at the moment payment was confirmed
 * (checkoutStorage.ts), which also means it survives a page refresh in
 * the SAME browser/tab. Opening this URL from a different browser or
 * after clearing site data won't show anything — an honest limitation
 * of guest checkout, called out in the Phase 2 report rather than
 * papered over with fake data.
 */
export function ConfirmationPage() {
  const { t } = useTranslation()
  const { bookingId } = useParams<{ bookingId: string }>()
  const snapshot = bookingId ? readConfirmationSnapshot(bookingId) : null

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <StateMessage
          tone="error"
          title={t('checkout.confirmation.notFoundTitle')}
          body={t('checkout.confirmation.notFoundBody')}
          action={
            <Link to="/" className="text-sm font-semibold text-brand-navy underline">
              {t('checkout.confirmation.backToHome')}
            </Link>
          }
        />
      </div>
    )
  }

  const isConfirmed = snapshot.bookingStatus === 'confirmed'

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="rounded-none border border-success/25 bg-success-bg p-6 text-center">
        <BadgeCheck className="mx-auto h-8 w-8 text-success" aria-hidden="true" />
        <h1 className="mt-2 text-xl font-semibold text-brand-navy">
          {isConfirmed ? t('checkout.confirmation.confirmed') : t('checkout.confirmation.received')}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t('checkout.confirmation.reference')}{' '}
          <span className="font-mono font-semibold text-brand-navy">{snapshot.bookingReference}</span>
        </p>
      </div>

      <div className="mt-6 space-y-4 rounded-none border border-brand-navy/10 bg-white p-6">
        <Row label={t('checkout.confirmation.vehicle')} value={`${snapshot.vehicleMake} ${snapshot.vehicleModel}`} />
        <Row label={t('checkout.confirmation.rentalDates')} value={`${snapshot.startDate} → ${snapshot.endDate}`} />
        <Row label={t('checkout.confirmation.pickup')} value={snapshot.pickupLocationName} />
        <Row label={t('checkout.confirmation.dropoff')} value={snapshot.dropoffLocationName} />
        <Row label={t('checkout.confirmation.customer')} value={snapshot.customerName} />
        <Row label={t('checkout.confirmation.driver')} value={snapshot.driverName} />
        <Row label={t('checkout.confirmation.amount')} value={`${snapshot.currency} ${snapshot.totalPrice.toLocaleString()}`} />
        <Row label={t('checkout.confirmation.paymentStatus')} value={snapshot.paymentStatus} highlight={snapshot.paymentStatus === 'paid'} />
        <Row label={t('checkout.confirmation.bookingStatus')} value={snapshot.bookingStatus} highlight={isConfirmed} />
      </div>

      <div className="mt-6 rounded-none border border-brand-navy/10 bg-brand-lavender/30 p-6">
        <h2 className="text-sm font-semibold text-brand-navy">{t('checkout.confirmation.whatNext')}</h2>
        <ul className="mt-3 space-y-2 text-sm text-text-muted">
          <li>• {t('checkout.confirmation.next1')}</li>
          <li>• {t('checkout.confirmation.next2')}</li>
          <li>• {t('checkout.confirmation.next3')}</li>
          <li>• {t('checkout.confirmation.next4')}</li>
          <li>
            • {t('checkout.confirmation.next5Prefix')}{' '}
            <Link to="/manage-booking" className="font-semibold text-brand-navy underline">
              {t('checkout.confirmation.next5Link')}
            </Link>
          </li>
        </ul>
      </div>

      <p className="mt-6 text-center text-sm text-text-muted">
        {t('checkout.confirmation.checkStatusLaterPrefix')}{' '}
        <Link to="/manage-booking" className="font-semibold text-brand-navy underline">
          {t('checkout.confirmation.checkStatusLaterLink')}
        </Link>
      </p>

      <div className="mt-4 text-center">
        <Link to="/" className="text-sm font-semibold text-brand-navy underline">
          {t('checkout.confirmation.backToHome')}
        </Link>
      </div>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className={'text-right font-medium capitalize ' + (highlight ? 'text-success' : 'text-brand-navy')}>
        {value.replace(/_/g, ' ')}
      </span>
    </div>
  )
}
