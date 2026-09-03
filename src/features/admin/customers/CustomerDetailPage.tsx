import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { fetchCustomerById, fetchCustomerBookings } from '@/features/admin/customers/adminCustomersApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { AdminStatusBadge } from '@/features/admin/shared/AdminStatusBadge'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import type { AdminBookingWithDetails } from '@/types/domain'
import type { Database } from '@/types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not_found' }
  | { status: 'loaded'; customer: CustomerRow; bookings: AdminBookingWithDetails[] }

export function CustomerDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setState({ status: 'loading' })
    fetchCustomerById(id)
      .then(async (customer) => {
        if (cancelled) return
        if (!customer) {
          setState({ status: 'not_found' })
          return
        }
        const bookings = await fetchCustomerBookings(id)
        if (!cancelled) setState({ status: 'loaded', customer, bookings })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric') })
      })
    return () => {
      cancelled = true
    }
  }, [id, t])

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (state.status === 'not_found') {
    return (
      <StateMessage
        title={t('admin.customers.notFoundTitle')}
        action={
          <Link to="/admin/customers" className="text-sm font-semibold text-brand-navy underline">
            {t('admin.customers.backToList')}
          </Link>
        }
      />
    )
  }

  if (state.status === 'error') {
    return <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />
  }

  const { customer, bookings } = state
  const currentBookings = bookings.filter((b) => b.status === 'active' || b.status === 'confirmed')
  const pastBookings = bookings.filter((b) => b.status === 'completed' || b.status === 'cancelled' || b.status === 'pending_payment')

  return (
    <div>
      <button type="button" onClick={() => navigate('/admin/customers')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-brand-navy">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('admin.customers.backToList')}
      </button>

      <AdminPageHeader title={customer.full_name} description={customer.email} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
          <h2 className="text-sm font-semibold text-brand-navy">{t('admin.customers.contactInfo')}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted">Email</dt>
              <dd className="font-medium text-brand-navy">{customer.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted">{t('checkout.customer.phone')}</dt>
              <dd className="font-medium text-brand-navy">{customer.phone ?? '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-brand-navy/10 bg-white p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-brand-navy">{t('admin.customers.currentBooking')}</h2>
          <BookingMiniList bookings={currentBookings} empty={t('admin.customers.noCurrentBooking')} />
        </div>

        <div className="rounded-2xl border border-brand-navy/10 bg-white p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-brand-navy">{t('admin.customers.bookingHistory')}</h2>
          <BookingMiniList bookings={pastBookings} empty={t('admin.customers.noPastBookings')} />
        </div>
      </div>
    </div>
  )
}

function BookingMiniList({ bookings, empty }: { bookings: AdminBookingWithDetails[]; empty: string }) {
  if (bookings.length === 0) return <p className="mt-3 text-sm text-text-muted">{empty}</p>
  return (
    <ul className="mt-3 divide-y divide-brand-navy/5">
      {bookings.map((b) => (
        <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <div className="min-w-0">
            <Link to={`/admin/bookings/${b.id}`} className="block truncate font-medium text-brand-navy hover:underline">
              {b.vehicles ? `${b.vehicles.make} ${b.vehicles.model}` : '—'}
            </Link>
            <p className="text-xs text-text-muted">
              {b.start_date} → {b.end_date}
            </p>
          </div>
          <AdminStatusBadge status={b.status} />
        </li>
      ))}
    </ul>
  )
}
