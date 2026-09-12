import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAdminAuth } from '@/features/admin/AdminAuthContext'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import {
  fetchStaffDirectory,
  setStaffActive,
  setStaffRole,
  createStaffAccount,
  generateTempPassword,
  type CreateStaffResult,
} from '@/features/admin/staff/staffApi'
import type { AdminProfile } from '@/types/domain'

type DirectoryState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; admins: AdminProfile[] }

type PendingAction =
  | { id: string; name: string; kind: 'suspend' }
  | { id: string; name: string; kind: 'reactivate' }
  | { id: string; name: string; kind: 'promote' }
  | { id: string; name: string; kind: 'demote' }

/**
 * "Staff Accounts" — the control screen the owner asked for so day-to-day
 * staff provisioning no longer needs a developer or the Supabase
 * dashboard. See supabase/migrations/20260901000000_staff_account_control.sql
 * for how every action here is also enforced in the database itself (not
 * just hidden by this UI), and supabase/functions/admin-create-staff for
 * why creating a login specifically needs an Edge Function.
 */
export function StaffAccountsPage() {
  const { t } = useTranslation()
  const { adminProfile } = useAdminAuth()
  const [directory, setDirectory] = useState<DirectoryState>({ status: 'loading' })
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => generateTempPassword())
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreateStaffResult | null>(null)

  function loadDirectory() {
    setDirectory({ status: 'loading' })
    fetchStaffDirectory()
      .then((admins) => setDirectory({ status: 'loaded', admins }))
      .catch((err: unknown) => {
        setDirectory({
          status: 'error',
          message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'),
        })
      })
  }

  useEffect(() => {
    loadDirectory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetForm() {
    setFullName('')
    setEmail('')
    setPassword(generateTempPassword())
    setShowPassword(false)
    setFieldErrors({})
    setSubmitError(null)
  }

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    setFieldErrors({})
    try {
      const result = await createStaffAccount({ fullName, email, password })
      setCreated(result)
      setShowAddForm(false)
      resetForm()
      loadDirectory()
    } catch (err) {
      if (err instanceof AdminApiError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors)
      }
      setSubmitError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) return
    setActionBusyId(pendingAction.id)
    setActionError(null)
    try {
      if (pendingAction.kind === 'suspend') await setStaffActive(pendingAction.id, false)
      else if (pendingAction.kind === 'reactivate') await setStaffActive(pendingAction.id, true)
      else if (pendingAction.kind === 'promote') await setStaffRole(pendingAction.id, 'super_admin')
      else await setStaffRole(pendingAction.id, 'staff')
      setPendingAction(null)
      loadDirectory()
    } catch (err) {
      setActionError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setActionBusyId(null)
    }
  }

  return (
    <div>
      <AdminPageHeader title={t('admin.nav.staff')} description={t('admin.staff.subtitle')} />

      {created && (
        <div className="mb-5 rounded-2xl border border-success/25 bg-success-bg p-5">
          <h2 className="text-sm font-semibold text-success">{t('admin.staff.created.title')}</h2>
          <p className="mt-1 text-sm text-success/90">
            {t('admin.staff.created.body', { name: created.fullName })}
          </p>
          <dl className="mt-3 space-y-1 rounded-lg border border-success/25 bg-white p-3 font-mono text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-muted">{t('admin.staff.form.email')}</dt>
              <dd className="font-medium text-brand-navy">{created.email}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="mt-3 rounded-lg border border-success/25 bg-white px-4 py-2 text-sm font-semibold text-success hover:bg-success-bg"
          >
            {t('admin.staff.created.dismiss')}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-brand-navy">{t('admin.staff.heading')}</h2>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowAddForm(true)
              }}
              className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-gold-light"
            >
              {t('admin.staff.addButton')}
            </button>
          )}
        </div>

        {showAddForm && (
          <form
            onSubmit={(e) => void handleCreateSubmit(e)}
            className="mt-4 space-y-3 rounded-xl border border-brand-navy/10 bg-brand-lavender/10 p-4"
          >
            <h3 className="text-sm font-semibold text-brand-navy">{t('admin.staff.form.title')}</h3>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t('admin.staff.form.fullName')}
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full max-w-sm rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
              />
              {fieldErrors.fullName && <p className="mt-1 text-xs font-medium text-error">{fieldErrors.fullName}</p>}
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t('admin.staff.form.email')}
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full max-w-sm rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
              />
              {fieldErrors.email && <p className="mt-1 text-xs font-medium text-error">{fieldErrors.email}</p>}
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t('admin.staff.form.password')}
              </span>
              <div className="flex max-w-sm items-center gap-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 font-mono text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-muted hover:bg-surface-muted"
                >
                  {showPassword ? t('admin.staff.form.hide') : t('admin.staff.form.show')}
                </button>
                <button
                  type="button"
                  onClick={() => setPassword(generateTempPassword())}
                  className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-muted hover:bg-surface-muted"
                >
                  {t('admin.staff.form.generate')}
                </button>
              </div>
              {fieldErrors.password && <p className="mt-1 text-xs font-medium text-error">{fieldErrors.password}</p>}
            </label>

            <p className="text-xs text-text-muted">{t('admin.staff.form.note')}</p>

            {submitError && !Object.keys(fieldErrors).length && (
              <p className="text-sm font-medium text-error">{submitError}</p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? t('admin.staff.form.submitting') : t('admin.staff.form.submit')}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text-muted hover:bg-surface-muted"
              >
                {t('admin.staff.cancel')}
              </button>
            </div>
          </form>
        )}

        {directory.status === 'loading' && (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        )}

        {directory.status === 'error' && (
          <div className="mt-4">
            <StateMessage tone="error" title={t('admin.errorGeneric')} body={directory.message} />
          </div>
        )}

        {directory.status === 'loaded' && directory.admins.length === 0 && (
          <div className="mt-4">
            <StateMessage tone="neutral" title={t('admin.staff.emptyTitle')} body={t('admin.staff.emptyBody')} />
          </div>
        )}

        {directory.status === 'loaded' && directory.admins.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-brand-navy/10 text-start text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <th className="py-2 pe-3 text-start">{t('admin.staff.table.nameColumn')}</th>
                  <th className="py-2 pe-3 text-start">{t('admin.staff.table.role')}</th>
                  <th className="py-2 pe-3 text-start">{t('admin.staff.table.status')}</th>
                  <th className="py-2 pe-3 text-start">{t('admin.staff.table.joined')}</th>
                  <th className="py-2 ps-3 text-end">{t('admin.staff.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-navy/5">
                {directory.admins.map((a) => {
                  const isSelf = a.id === adminProfile?.id
                  const isRowBusy = actionBusyId === a.id
                  const isConfirming = pendingAction?.id === a.id
                  return (
                    <tr key={a.id}>
                      <td className="py-3 pe-3 font-medium text-brand-navy">
                        {a.full_name}
                        {isSelf && (
                          <span className="ms-2 rounded-full bg-brand-navy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-navy">
                            {t('admin.staff.table.you')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pe-3 text-text-muted">{t(`admin.settings.roles.${a.role}`)}</td>
                      <td className="py-3 pe-3">
                        <span
                          className={
                            'rounded-full px-2 py-0.5 text-xs font-semibold ' +
                            (a.is_active ? 'bg-success-bg text-success' : 'bg-surface-muted text-text-muted')
                          }
                        >
                          {a.is_active ? t('admin.staff.status.active') : t('admin.staff.status.suspended')}
                        </span>
                      </td>
                      <td className="py-3 pe-3 text-text-muted">{new Date(a.created_at).toLocaleDateString()}</td>
                      <td className="py-3 ps-3 text-end">
                        {isSelf ? (
                          <span className="text-xs text-text-muted">—</span>
                        ) : isConfirming ? (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <span className="text-xs text-brand-navy">
                              {t(`admin.staff.actions.confirm${capitalize(pendingAction.kind)}`, { name: a.full_name })}
                            </span>
                            <button
                              type="button"
                              disabled={isRowBusy}
                              onClick={() => void confirmPendingAction()}
                              className="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isRowBusy ? '…' : t('admin.staff.actions.yes')}
                            </button>
                            <button
                              type="button"
                              disabled={isRowBusy}
                              onClick={() => setPendingAction(null)}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-muted"
                            >
                              {t('admin.staff.actions.cancel')}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setPendingAction({
                                  id: a.id,
                                  name: a.full_name,
                                  kind: a.is_active ? 'suspend' : 'reactivate',
                                })
                              }
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-muted"
                            >
                              {a.is_active ? t('admin.staff.actions.suspend') : t('admin.staff.actions.reactivate')}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPendingAction({
                                  id: a.id,
                                  name: a.full_name,
                                  kind: a.role === 'staff' ? 'promote' : 'demote',
                                })
                              }
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-muted"
                            >
                              {a.role === 'staff' ? t('admin.staff.actions.promote') : t('admin.staff.actions.demote')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {actionError && <p className="mt-3 text-sm font-medium text-error">{actionError}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function capitalize<T extends string>(kind: T): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}
