import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Car,
  CreditCard,
  FileText,
  History as HistoryIcon,
  IdCard,
  KeyRound,
  MapPin,
  PlayCircle,
  ShieldCheck,
  User,
  XCircle,
} from 'lucide-react'
import {
  fetchBookingById,
  fetchBookingStatusHistory,
  adminConfirmBookingPayment,
  adminCancelBooking,
  adminStartRental,
  adminMarkReturned,
  adminConfirmBookingVehicle,
  fetchDriverDocumentUrl,
  type AdminConfirmBookingVehicleResult,
} from '@/features/admin/bookings/adminBookingsApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { useAdminAuth } from '@/features/admin/AdminAuthContext'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { AdminStatusBadge } from '@/features/admin/shared/AdminStatusBadge'
import { RentalExtensionsSection } from '@/features/admin/extensions/RentalExtensionsSection'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import { Button } from '@/features/shared/ui'
import type { ButtonVariant } from '@/features/shared/ui/buttonClasses'
import type { AdminBookingWithDetails, AdminBookingStatusHistoryEntry } from '@/types/domain'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not_found' }
  | { status: 'loaded'; booking: AdminBookingWithDetails; history: AdminBookingStatusHistoryEntry[] }

export function BookingDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  // Kept outside LoadState (not reset by load()'s 'loading' status) so the
  // Confirm Vehicle result banner survives the reload that action itself
  // triggers — the banner shows once, until the admin navigates away.
  const [vehicleConfirmResult, setVehicleConfirmResult] = useState<AdminConfirmBookingVehicleResult | null>(null)

  async function load() {
    if (!id) return
    setState({ status: 'loading' })
    try {
      const booking = await fetchBookingById(id)
      if (!booking) {
        setState({ status: 'not_found' })
        return
      }
      const history = await fetchBookingStatusHistory(id)
      setState({ status: 'loaded', booking, history })
    } catch (err) {
      setState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric') })
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Spinner className="h-8 w-8" />
        <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
      </div>
    )
  }

  if (state.status === 'not_found') {
    return (
      <StateMessage
        title={t('admin.bookings.notFoundTitle')}
        action={
          <Link to="/admin/bookings" className="text-sm font-semibold text-brand-navy underline">
            {t('admin.bookings.backToList')}
          </Link>
        }
      />
    )
  }

  if (state.status === 'error') {
    return <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />
  }

  const { booking, history } = state
  const payment = booking.payments[0] ?? null
  const driver = booking.drivers[0] ?? null

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/admin/bookings')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-brand-navy"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('admin.bookings.backToList')}
      </button>

      <AdminPageHeader
        title={t('admin.bookings.detailTitle')}
        description={`${t('admin.bookings.reference')}: ${booking.id}`}
        action={<AdminStatusBadge status={booking.status} />}
      />

      {vehicleConfirmResult && (
        <div className="mb-5 rounded-2xl border border-success/25 bg-success-bg p-4 text-sm text-success">
          {t(
            vehicleConfirmResult.isNewPhysicalVehicle
              ? 'admin.bookings.confirmVehicle.resultNew'
              : 'admin.bookings.confirmVehicle.resultExisting',
            { plate: vehicleConfirmResult.plateNumber },
          )}
        </div>
      )}

      <div className="mb-5">
        <BookingActionsPanel
          booking={booking}
          onChanged={() => void load()}
          onVehicleConfirmed={(result) => {
            setVehicleConfirmResult(result)
            void load()
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title={t('admin.bookings.section.booking')} icon={<Calendar className="h-4 w-4" aria-hidden="true" />}>
          <Row label={t('admin.bookings.columns.status')} value={<AdminStatusBadge status={booking.status} />} />
          <Row label={t('admin.bookings.createdDate')} value={new Date(booking.created_at).toLocaleString()} />
          <Row label={t('admin.bookings.reference')} value={<span className="font-mono text-xs">{booking.id}</span>} />
        </Section>

        <Section title={t('admin.bookings.section.customer')} icon={<User className="h-4 w-4" aria-hidden="true" />}>
          <Row label={t('admin.bookings.columns.customer')} value={booking.customers?.full_name ?? '—'} />
          <Row label="Email" value={booking.customers?.email ?? '—'} />
          <Row label={t('checkout.customer.phone')} value={booking.customers?.phone ?? '—'} />
        </Section>

        <Section title={t('admin.bookings.section.driver')} icon={<IdCard className="h-4 w-4" aria-hidden="true" />}>
          {driver ? (
            <>
              <Row label={t('admin.bookings.driverFullName')} value={driver.full_name} />
              <Row label={t('admin.bookings.driverPhone')} value={driver.phone ?? '—'} />
              {driver.date_of_birth && <Row label={t('admin.bookings.driverDateOfBirth')} value={driver.date_of_birth} />}
              <Row label={t('checkout.driver.licenseNumber')} value={driver.license_number} />
              <Row label={t('checkout.driver.licenseCountry')} value={driver.license_country} />
              <Row label={t('checkout.driver.licenseExpiry')} value={driver.license_expiry} />
              <DriverDocumentRow label={t('admin.bookings.licenseDocument')} path={driver.license_document_path} />
              <DriverDocumentRow label={t('admin.bookings.idDocument')} path={driver.id_document_path} />
            </>
          ) : (
            <p className="text-sm text-text-muted">{t('admin.bookings.noDriver')}</p>
          )}
        </Section>

        <Section title={t('admin.bookings.section.rental')} icon={<Car className="h-4 w-4" aria-hidden="true" />}>
          <Row label={t('checkout.summary.vehicle')} value={booking.vehicles ? `${booking.vehicles.make} ${booking.vehicles.model} (${booking.vehicles.model_year})` : '—'} />
          <Row
            label={t('admin.fleet.fields.plateNumber')}
            value={
              // Phase 14 — Decision 5: the real plate is never shown to the
              // customer before Admin confirms it, and the internal
              // RSV-prefixed placeholder plate on a still-unconfirmed
              // Reserved copy is not a real plate either — so this admin
              // view shows the "pending" wording, not the placeholder
              // string, until is_master_listing flips to true.
              booking.vehicles && booking.vehicles.is_master_listing === false
                ? t('admin.bookings.confirmVehicle.pending')
                : (booking.vehicles?.plate_number ?? '—')
            }
          />
          <Row label={t('vehicleDetail.dates')} value={`${booking.start_date} → ${booking.end_date}`} />
          <Row
            label={t('admin.bookings.pickup')}
            value={
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
                {booking.pickup_location?.name ?? '—'}
              </span>
            }
          />
          <Row
            label={t('admin.bookings.dropoff')}
            value={
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
                {booking.dropoff_location?.name ?? '—'}
              </span>
            }
          />
        </Section>

        <Section title={t('admin.bookings.section.payment')} icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}>
          <Row label={t('admin.bookings.columns.amount')} value={`${booking.currency} ${booking.total_price.toLocaleString()}`} />
          <Row label={t('admin.bookings.columns.payment')} value={payment ? <AdminStatusBadge status={payment.status} /> : '—'} />
          <Row label={t('admin.payments.columns.reference')} value={payment?.provider_reference ?? '—'} />
        </Section>

        <Section title={t('admin.bookings.section.history')} icon={<HistoryIcon className="h-4 w-4" aria-hidden="true" />}>
          {history.length === 0 ? (
            <p className="text-sm text-text-muted">{t('admin.bookings.noHistory')}</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-xs">
                  <span>
                    {h.old_status ? t(`admin.status.${h.old_status}`) : '—'} → {t(`admin.status.${h.new_status}`)}
                  </span>
                  <span className="text-text-muted">{new Date(h.changed_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <RentalExtensionsSection bookingId={booking.id} bookingStatus={booking.status} onBookingChanged={() => void load()} />
      </div>
    </div>
  )
}

/**
 * Phase 11 — replaces the old unrestricted `<select>` (every status,
 * wired to a bare RLS UPDATE with no payment-consistency check; see
 * claude/phase-11-premium-booking-admin-audit-and-plan-2026-09-02.md §0)
 * with a small set of named, controlled actions, each gated to the
 * transitions that are actually legal for the booking's *current*
 * status. The database is the real, always-enforced gate (each RPC
 * checks is_super_admin() and the precondition status itself); this
 * panel only avoids offering an action that would just be rejected.
 *
 * pending_payment -> Confirm Payment Received, Cancel Booking
 * confirmed       -> Start Rental, Cancel Booking
 * active          -> Mark Returned
 * completed / cancelled -> terminal, no actions
 */
function BookingActionsPanel({
  booking,
  onChanged,
  onVehicleConfirmed,
}: {
  booking: AdminBookingWithDetails
  onChanged: () => void
  onVehicleConfirmed: (result: AdminConfirmBookingVehicleResult) => void
}) {
  const { t } = useTranslation()
  const payment = booking.payments[0] ?? null

  const canConfirmPayment = booking.status === 'pending_payment' && !!payment && payment.status !== 'paid'
  const canCancel = booking.status === 'pending_payment' || booking.status === 'confirmed'
  const canStartRental = booking.status === 'confirmed'
  const canMarkReturned = booking.status === 'active'
  // Phase 14 — the booking's linked vehicle is still the temporary
  // Reserved copy (is_master_listing: false) until Admin confirms the
  // real plate; once confirmed, vehicle_id points at a real physical
  // vehicle (is_master_listing: true for a reused existing vehicle, or
  // the same row renamed in place for a brand-new one — either way
  // is_master_listing becomes true), so this action naturally stops
  // showing after a successful confirmation.
  const canConfirmVehicle =
    !!booking.vehicles && booking.vehicles.is_master_listing === false && (booking.status === 'confirmed' || booking.status === 'active')
  const hasAnyAction = canConfirmPayment || canCancel || canStartRental || canMarkReturned || canConfirmVehicle

  return (
    <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-brand-gold" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-brand-navy">{t('admin.bookings.actions.title')}</h2>
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-3">
        {canConfirmPayment && (
          <StatusAction
            variant="success"
            icon={<BadgeCheck className="h-4 w-4" aria-hidden="true" />}
            i18nKey="confirmPayment"
            onConfirm={(note) => adminConfirmBookingPayment(booking.id, note)}
            onDone={onChanged}
          />
        )}
        {canStartRental && (
          <StatusAction
            variant="secondary"
            icon={<PlayCircle className="h-4 w-4" aria-hidden="true" />}
            i18nKey="actions.startRental"
            onConfirm={(note) => adminStartRental(booking.id, note)}
            onDone={onChanged}
          />
        )}
        {canMarkReturned && (
          <StatusAction
            variant="success"
            icon={<BadgeCheck className="h-4 w-4" aria-hidden="true" />}
            i18nKey="actions.markReturned"
            onConfirm={(note) => adminMarkReturned(booking.id, note)}
            onDone={onChanged}
          />
        )}
        {canCancel && (
          <StatusAction
            variant="danger"
            icon={<XCircle className="h-4 w-4" aria-hidden="true" />}
            i18nKey="actions.cancelBooking"
            onConfirm={(note) => adminCancelBooking(booking.id, note)}
            onDone={onChanged}
          />
        )}
        {canConfirmVehicle && <ConfirmVehicleAction bookingId={booking.id} onDone={onVehicleConfirmed} />}
        {!hasAnyAction && (
          <p className="text-xs text-text-muted">
            {t('admin.bookings.actions.noneAvailable', { status: t(`admin.status.${booking.status}`) })}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * One controlled action: a Super-Admin-only button that reveals an
 * optional note + Confirm/Cancel before calling the given RPC wrapper.
 * Shared by every Phase 11 booking action (confirm payment, cancel,
 * start rental, mark returned) so the reveal/confirm/error UX — and the
 * is_super_admin() staff-hint fallback — is written once.
 */
function StatusAction({
  variant,
  icon,
  i18nKey,
  onConfirm,
  onDone,
}: {
  variant: ButtonVariant
  icon: ReactNode
  i18nKey: string
  onConfirm: (note: string) => Promise<void>
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { adminProfile } = useAdminAuth()
  const isSuperAdmin = adminProfile?.role === 'super_admin'
  const [confirming, setConfirming] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const base = `admin.bookings.${i18nKey}`

  if (!isSuperAdmin) {
    return <p className="text-xs text-text-muted">{t(`${base}.staffHint`)}</p>
  }

  async function handleConfirm() {
    setConfirming(true)
    setError(null)
    try {
      await onConfirm(note)
      onDone()
    } catch (err) {
      setError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setConfirming(false)
    }
  }

  if (!showNote) {
    return (
      <Button size="compact" variant={variant} onClick={() => setShowNote(true)}>
        {icon}
        {t(`${base}.action`)}
      </Button>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-2 rounded-lg border border-border bg-surface-muted p-3">
      <p className="text-xs text-text-muted">{t(`${base}.prompt`)}</p>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t(`${base}.notePlaceholder`)}
        className="w-full rounded-lg border border-brand-navy/20 bg-white px-2.5 py-1.5 text-xs text-brand-navy outline-none focus:border-brand-navy"
      />
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex items-center gap-2">
        <Button size="compact" variant={variant} loading={confirming} onClick={() => void handleConfirm()}>
          {t(`${base}.confirm`)}
        </Button>
        <Button size="compact" variant="ghost" disabled={confirming} onClick={() => setShowNote(false)}>
          {t(`${base}.cancel`)}
        </Button>
      </div>
    </div>
  )
}

/**
 * Phase 14 — Super-Admin-only "Confirm Vehicle" action: Admin has
 * arranged a physical car and enters its real plate. Unlike StatusAction
 * (a bare note), this needs a required plate-number field and returns
 * structured data (new vs. existing vehicle) the caller displays as a
 * result banner rather than a simple boolean "done".
 */
function ConfirmVehicleAction({
  bookingId,
  onDone,
}: {
  bookingId: string
  onDone: (result: AdminConfirmBookingVehicleResult) => void
}) {
  const { t } = useTranslation()
  const { adminProfile } = useAdminAuth()
  const isSuperAdmin = adminProfile?.role === 'super_admin'
  const [confirming, setConfirming] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [plate, setPlate] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const base = 'admin.bookings.confirmVehicle'

  if (!isSuperAdmin) {
    return <p className="text-xs text-text-muted">{t(`${base}.staffHint`)}</p>
  }

  async function handleConfirm() {
    if (!plate.trim()) {
      setError(t(`${base}.plateRequired`))
      return
    }
    setConfirming(true)
    setError(null)
    try {
      const result = await adminConfirmBookingVehicle(bookingId, plate, note)
      onDone(result)
    } catch (err) {
      setError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setConfirming(false)
    }
  }

  if (!showForm) {
    return (
      <Button size="compact" variant="secondary" onClick={() => setShowForm(true)}>
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        {t(`${base}.action`)}
      </Button>
    )
  }

  return (
    <div className="w-full max-w-sm space-y-2 rounded-lg border border-border bg-surface-muted p-3">
      <p className="text-xs text-text-muted">{t(`${base}.prompt`)}</p>
      <label className="block text-xs font-medium text-brand-navy">
        {t(`${base}.plateLabel`)}
        <input
          type="text"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder={t(`${base}.platePlaceholder`)}
          className="mt-1 w-full rounded-lg border border-brand-navy/20 bg-white px-2.5 py-1.5 text-xs text-brand-navy outline-none focus:border-brand-navy"
        />
      </label>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t(`${base}.notePlaceholder`)}
        className="w-full rounded-lg border border-brand-navy/20 bg-white px-2.5 py-1.5 text-xs text-brand-navy outline-none focus:border-brand-navy"
      />
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex items-center gap-2">
        <Button size="compact" variant="secondary" loading={confirming} onClick={() => void handleConfirm()}>
          {t(`${base}.confirm`)}
        </Button>
        <Button size="compact" variant="ghost" disabled={confirming} onClick={() => setShowForm(false)}>
          {t(`${base}.cancel`)}
        </Button>
      </div>
    </div>
  )
}

function DriverDocumentRow({ label, path }: { label: string; path: string | null }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleView() {
    if (!path) return
    setLoading(true)
    setError(null)
    try {
      const url = await fetchDriverDocumentUrl(path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="flex items-center gap-1.5 text-text-muted">
        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-right">
        {path ? (
          <button type="button" onClick={() => void handleView()} disabled={loading} className="font-semibold text-brand-navy underline">
            {loading ? t('common.loading') : t('admin.bookings.viewDocument')}
          </button>
        ) : (
          <span className="text-text-muted">{t('admin.bookings.noDocument')}</span>
        )}
        {error && <p className="text-xs text-error">{error}</p>}
      </dd>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
        {icon && <span className="text-brand-gold">{icon}</span>}
        {title}
      </h2>
      <dl className="mt-3 space-y-2 text-sm">{children}</dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium text-brand-navy">{value}</dd>
    </div>
  )
}
