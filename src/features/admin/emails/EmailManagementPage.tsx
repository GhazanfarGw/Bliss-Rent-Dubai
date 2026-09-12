import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  fetchEmailLog,
  fetchEmailLogEventTypes,
  fetchEmailPreviewCatalog,
  fetchEmailPreviewHtml,
  sendTestEmail,
  type EmailLogFilters,
} from '@/features/admin/emails/adminEmailApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { AdminTabs, type AdminTab } from '@/features/admin/shared/AdminTabs'
import { AdminStatusBadge } from '@/features/admin/shared/AdminStatusBadge'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import type { AdminEmailLogEntry, AdminEmailPreviewCatalogEntry } from '@/types/domain'
import type { EmailDeliveryStatus, EmailLanguageCode, EmailRecipientType } from '@/types/database'

type PageTab = 'log' | 'templates'

const STATUS_OPTIONS: EmailDeliveryStatus[] = ['queued', 'sent', 'delivered', 'bounced', 'failed']

/**
 * Phase 9J — Admin Email Management dashboard. Two tabs:
 *   - Delivery log: a read-only, filterable view onto email_log (9C) —
 *     mirrors AuditLogPage.tsx's list/filter shape exactly.
 *   - Templates & test send: the admin-facing front end for the 9I
 *     preview-send-email Edge Function — render any template against
 *     fake QA data, and optionally test-send it for real to a
 *     server-allowlisted address only.
 *
 * Neither tab can edit or resend a historical email — this dashboard is
 * observability plus a QA tool, not a new send path.
 */
export function EmailManagementPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<PageTab>('log')

  const tabs: AdminTab<PageTab>[] = [
    { value: 'log', label: t('admin.emails.tabs.log') },
    { value: 'templates', label: t('admin.emails.tabs.templates') },
  ]

  return (
    <div>
      <AdminPageHeader title={t('admin.nav.emails')} description={t('admin.emails.subtitle')} />
      <AdminTabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'log' ? <EmailLogTab /> : <EmailTemplatesTab />}
    </div>
  )
}

type LogLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; entries: AdminEmailLogEntry[] }

function EmailLogTab() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<EmailLogFilters>({})
  const [recipientSearchDraft, setRecipientSearchDraft] = useState('')
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const [state, setState] = useState<LogLoadState>({ status: 'loading' })

  useEffect(() => {
    fetchEmailLogEventTypes()
      .then(setEventTypes)
      .catch(() => {
        // Non-critical — the event-type filter just stays empty if this fails.
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetchEmailLog(filters)
      .then((entries) => {
        if (!cancelled) setState({ status: 'loaded', entries })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric') })
      })
    return () => {
      cancelled = true
    }
  }, [filters, t])

  function handleRecipientSearchSubmit(e: FormEvent) {
    e.preventDefault()
    setFilters((prev) => ({ ...prev, recipientSearch: recipientSearchDraft.trim() || undefined }))
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-text-muted">{t('admin.emails.log.filters.status')}</span>
          <select
            value={filters.status ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: (e.target.value || undefined) as EmailDeliveryStatus | undefined }))}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy"
          >
            <option value="">{t('admin.emails.log.filters.allStatuses')}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`admin.status.${s}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-text-muted">{t('admin.emails.log.filters.eventType')}</span>
          <select
            value={filters.eventType ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, eventType: e.target.value || undefined }))}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy"
          >
            <option value="">{t('admin.emails.log.filters.allEventTypes')}</option>
            {eventTypes.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-text-muted">{t('admin.emails.log.filters.recipientType')}</span>
          <select
            value={filters.recipientType ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, recipientType: (e.target.value || undefined) as EmailRecipientType | undefined }))}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy"
          >
            <option value="">{t('admin.emails.log.filters.allRecipients')}</option>
            <option value="customer">{t('admin.emails.log.filters.customer')}</option>
            <option value="admin">{t('admin.emails.log.filters.admin')}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-text-muted">{t('admin.emails.log.filters.language')}</span>
          <select
            value={filters.language ?? ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, language: (e.target.value || undefined) as EmailLanguageCode | undefined }))}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy"
          >
            <option value="">{t('admin.emails.log.filters.allLanguages')}</option>
            <option value="en">EN</option>
            <option value="ar">AR</option>
          </select>
        </label>

        <form onSubmit={handleRecipientSearchSubmit} className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-text-muted">{t('admin.emails.log.filters.recipientSearch')}</span>
          <input
            type="text"
            value={recipientSearchDraft}
            onChange={(e) => setRecipientSearchDraft(e.target.value)}
            placeholder={t('admin.emails.log.filters.recipientSearchPlaceholder')}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy"
          />
        </form>
      </div>

      {state.status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
        </div>
      )}

      {state.status === 'error' && <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />}

      {state.status === 'loaded' && state.entries.length === 0 && (
        <StateMessage title={t('admin.emails.log.emptyTitle')} body={t('admin.emails.log.emptyBody')} />
      )}

      {state.status === 'loaded' && state.entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-brand-navy/10 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-brand-navy/10 text-xs font-semibold uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 text-start">{t('admin.emails.log.columns.event')}</th>
                <th className="px-4 py-3 text-start">{t('admin.emails.log.columns.recipient')}</th>
                <th className="px-4 py-3 text-start">{t('admin.emails.log.columns.language')}</th>
                <th className="px-4 py-3 text-start">{t('admin.emails.log.columns.status')}</th>
                <th className="px-4 py-3 text-start">{t('admin.emails.log.columns.date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-navy/5">
              {state.entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-brand-lavender/20">
                  <td className="px-4 py-3 font-medium text-brand-navy">{entry.event_type}</td>
                  <td className="px-4 py-3">
                    <span>{entry.recipient_email}</span>
                    <span className="ms-1.5 text-xs text-text-muted">
                      ({t(`admin.emails.log.filters.${entry.recipient_type}`)})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs uppercase">{entry.language}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={entry.status} />
                  </td>
                  <td className="px-4 py-3 text-xs">{new Date(entry.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type CatalogLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; catalog: AdminEmailPreviewCatalogEntry[] }

type PreviewState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'loaded'; html: string }

type SendState = { status: 'idle' } | { status: 'sending' } | { status: 'error'; message: string } | { status: 'sent' }

function EmailTemplatesTab() {
  const { t } = useTranslation()
  const [catalogState, setCatalogState] = useState<CatalogLoadState>({ status: 'loading' })
  const [category, setCategory] = useState<AdminEmailPreviewCatalogEntry['category'] | ''>('')
  const [eventType, setEventType] = useState('')
  const [language, setLanguage] = useState<EmailLanguageCode>('en')
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' })
  const [recipientEmail, setRecipientEmail] = useState('')
  const [sendState, setSendState] = useState<SendState>({ status: 'idle' })

  useEffect(() => {
    fetchEmailPreviewCatalog()
      .then((catalog) => {
        setCatalogState({ status: 'loaded', catalog })
        if (catalog.length > 0) {
          setCategory(catalog[0].category)
          setEventType(catalog[0].eventType)
        }
      })
      .catch((err: unknown) => {
        setCatalogState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.emails.templates.catalogError') })
      })
    // Loaded once — the catalog is a static list of templates this build supports, not data that changes per-view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const templatesForCategory = useMemo(() => {
    if (catalogState.status !== 'loaded' || !category) return []
    return catalogState.catalog.filter((c) => c.category === category)
  }, [catalogState, category])

  function handleCategoryChange(next: AdminEmailPreviewCatalogEntry['category']) {
    setCategory(next)
    const firstForCategory = catalogState.status === 'loaded' ? catalogState.catalog.find((c) => c.category === next) : undefined
    setEventType(firstForCategory?.eventType ?? '')
    setPreview({ status: 'idle' })
    setSendState({ status: 'idle' })
  }

  async function handleLoadPreview() {
    if (!category || !eventType) return
    setPreview({ status: 'loading' })
    setSendState({ status: 'idle' })
    try {
      const html = await fetchEmailPreviewHtml(category, eventType, language)
      setPreview({ status: 'loaded', html })
    } catch (err) {
      setPreview({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.emails.templates.previewError') })
    }
  }

  async function handleSendTest(e: FormEvent) {
    e.preventDefault()
    if (!category || !eventType || !recipientEmail.trim()) return
    setSendState({ status: 'sending' })
    try {
      await sendTestEmail(category, eventType, language, recipientEmail.trim())
      setSendState({ status: 'sent' })
    } catch (err) {
      setSendState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric') })
    }
  }

  if (catalogState.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Spinner className="h-8 w-8" />
        <p className="mt-3 text-sm text-text-muted">{t('common.loading')}</p>
      </div>
    )
  }

  if (catalogState.status === 'error') {
    return <StateMessage tone="error" title={t('admin.errorGeneric')} body={catalogState.message} />
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
        <p className="mb-4 text-sm text-text-muted">{t('admin.emails.templates.intro')}</p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-text-muted">{t('admin.emails.templates.category')}</span>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as AdminEmailPreviewCatalogEntry['category'])}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy"
            >
              <option value="customer">{t('admin.emails.templates.categories.customer')}</option>
              <option value="admin">{t('admin.emails.templates.categories.admin')}</option>
              <option value="complaint">{t('admin.emails.templates.categories.complaint')}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-text-muted">{t('admin.emails.templates.template')}</span>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="min-w-[220px] rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy"
            >
              {templatesForCategory.map((entry) => (
                <option key={entry.eventType} value={entry.eventType}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-text-muted">{t('admin.emails.templates.language')}</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as EmailLanguageCode)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy"
            >
              <option value="en">EN</option>
              <option value="ar">AR</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => void handleLoadPreview()}
            disabled={!eventType || preview.status === 'loading'}
            className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {preview.status === 'loading' ? t('admin.emails.templates.loadingPreview') : t('admin.emails.templates.loadPreview')}
          </button>
        </div>

        {preview.status === 'error' && (
          <div className="mt-4">
            <StateMessage tone="error" title={t('admin.errorGeneric')} body={preview.message} />
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-brand-navy/10" style={{ height: 480 }}>
          {preview.status === 'loaded' ? (
            <iframe title={t('admin.emails.templates.previewFrameTitle')} srcDoc={preview.html} className="h-full w-full" sandbox="" />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-muted text-sm text-text-muted">
              {t('admin.emails.templates.loadPreview')}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
        <h3 className="text-sm font-semibold text-brand-navy">{t('admin.emails.templates.sendTest.title')}</h3>
        <p className="mt-1 text-sm text-text-muted">{t('admin.emails.templates.sendTest.intro')}</p>

        <form onSubmit={(e) => void handleSendTest(e)} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-text-muted">{t('admin.emails.templates.sendTest.recipientLabel')}</span>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder={t('admin.emails.templates.sendTest.recipientPlaceholder')}
              className="w-full max-w-sm rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
            />
          </label>

          {preview.status !== 'loaded' && <p className="text-xs text-text-muted">{t('admin.emails.templates.sendTest.previewFirst')}</p>}

          <button
            type="submit"
            disabled={preview.status !== 'loaded' || !recipientEmail.trim() || sendState.status === 'sending'}
            className="w-fit rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sendState.status === 'sending' ? t('admin.emails.templates.sendTest.sending') : t('admin.emails.templates.sendTest.sendButton')}
          </button>

          {sendState.status === 'sent' && (
            <StateMessage tone="success" title={t('admin.emails.templates.sendTest.success')} />
          )}
          {sendState.status === 'error' && <StateMessage tone="error" title={t('admin.errorGeneric')} body={sendState.message} />}
        </form>
      </div>
    </div>
  )
}
