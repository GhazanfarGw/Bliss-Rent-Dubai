import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import {
  fetchComplaintById,
  updateComplaint,
  sendComplaintReply,
  fetchComplaintThread,
  sendComplaintChatMessage,
  getComplaintAttachmentUrl,
} from '@/features/admin/complaints/adminComplaintsApi'
import { AdminApiError } from '@/features/admin/adminApi'
import { AdminPageHeader } from '@/features/admin/shared/AdminPageHeader'
import { AdminStatusBadge } from '@/features/admin/shared/AdminStatusBadge'
import { StateMessage, Spinner } from '@/features/shared/StateMessage'
import type { AdminComplaintMessage, AdminComplaintWithDetails } from '@/types/domain'
import type { Database } from '@/types/database'

type ComplaintStatus = Database['public']['Tables']['complaints']['Row']['status']

const STATUS_OPTIONS: ComplaintStatus[] = ['open', 'in_progress', 'resolved', 'closed']

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not_found' }
  | { status: 'loaded'; complaint: AdminComplaintWithDetails }

export function ComplaintDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [statusDraft, setStatusDraft] = useState<ComplaintStatus>('open')
  const [notesDraft, setNotesDraft] = useState('')
  const [resolutionDraft, setResolutionDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [replyDraft, setReplyDraft] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [replyResult, setReplyResult] = useState<'sent' | 'email_failed' | null>(null)

  // Live chat (Support Chat widget thread) — separate load/error state from
  // the complaint itself, since a chat load problem shouldn't block the
  // rest of the page (details/manage/reply-by-email) from rendering.
  const [thread, setThread] = useState<AdminComplaintMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(true)
  const [threadError, setThreadError] = useState<string | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [chatDraft, setChatDraft] = useState('')
  const [sendingChat, setSendingChat] = useState(false)
  const [chatSendError, setChatSendError] = useState<string | null>(null)

  async function loadThread(complaintId: string) {
    setThreadLoading(true)
    setThreadError(null)
    try {
      const messages = await fetchComplaintThread(complaintId)
      setThread(messages)
      const paths = [...new Set(messages.map((m) => m.image_path).filter((p): p is string => Boolean(p)))]
      if (paths.length > 0) {
        const entries = await Promise.all(paths.map(async (path) => [path, await getComplaintAttachmentUrl(path)] as const))
        setImageUrls((prev) => {
          const next = { ...prev }
          for (const [path, url] of entries) if (url) next[path] = url
          return next
        })
      }
    } catch (err) {
      setThreadError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.complaints.liveChat.loadError'))
    } finally {
      setThreadLoading(false)
    }
  }

  async function handleSendChat() {
    if (!id || sendingChat || !chatDraft.trim()) return
    setSendingChat(true)
    setChatSendError(null)
    try {
      await sendComplaintChatMessage(id, chatDraft)
      setChatDraft('')
      await loadThread(id)
    } catch (err) {
      setChatSendError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.complaints.liveChat.error'))
    } finally {
      setSendingChat(false)
    }
  }

  async function load() {
    if (!id) return
    setState({ status: 'loading' })
    try {
      const complaint = await fetchComplaintById(id)
      if (!complaint) {
        setState({ status: 'not_found' })
        return
      }
      setState({ status: 'loaded', complaint })
      setStatusDraft(complaint.status)
      setNotesDraft(complaint.internal_notes ?? '')
      setResolutionDraft(complaint.resolution ?? '')
      setReplyDraft(complaint.admin_reply_message ?? '')
      void loadThread(complaint.id)
    } catch (err) {
      setState({ status: 'error', message: err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric') })
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSave() {
    if (!id || saving) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      await updateComplaint(id, { status: statusDraft, internalNotes: notesDraft, resolution: resolutionDraft })
      await load()
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.errorGeneric'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSendReply() {
    if (!id || sendingReply) return
    if (!replyDraft.trim()) {
      setReplyError(t('admin.complaints.reply.emptyError'))
      return
    }
    setSendingReply(true)
    setReplyError(null)
    setReplyResult(null)
    try {
      const result = await sendComplaintReply(id, replyDraft)
      await load()
      setReplyResult(result.emailTriggered ? 'sent' : 'email_failed')
    } catch (err) {
      setReplyError(err instanceof AdminApiError || err instanceof Error ? err.message : t('admin.complaints.reply.error'))
    } finally {
      setSendingReply(false)
    }
  }

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
        title={t('admin.complaints.notFoundTitle')}
        action={
          <Link to="/admin/complaints" className="text-sm font-semibold text-brand-navy underline">
            {t('admin.complaints.backToList')}
          </Link>
        }
      />
    )
  }

  if (state.status === 'error') {
    return <StateMessage tone="error" title={t('admin.errorGeneric')} body={state.message} />
  }

  const { complaint } = state
  const chatItems = buildDisplayThread(complaint, thread)

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/admin/complaints')}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-brand-navy"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('admin.complaints.backToList')}
      </button>

      <AdminPageHeader
        title={complaint.subject}
        description={`${t('admin.complaints.columns.date')}: ${new Date(complaint.created_at).toLocaleString()}`}
        action={<AdminStatusBadge status={complaint.status} />}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title={t('admin.complaints.section.details')}>
          <Row label={t('admin.complaints.columns.customer')} value={complaint.customers?.full_name ?? '—'} />
          <Row label="Email" value={complaint.customers?.email ?? '—'} />
          <Row
            label={t('admin.complaints.columns.booking')}
            value={
              complaint.bookings ? (
                <Link to={`/admin/bookings/${complaint.bookings.id}`} className="font-mono text-xs text-brand-navy underline">
                  {complaint.bookings.id.slice(0, 8)}
                </Link>
              ) : (
                '—'
              )
            }
          />
          <div className="pt-1">
            <dt className="mb-1 text-sm text-text-muted">{t('admin.complaints.columns.complaint')}</dt>
            <dd className="whitespace-pre-wrap text-sm font-medium text-brand-navy">{complaint.description}</dd>
          </div>
        </Section>

        <Section title={t('admin.complaints.section.manage')}>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('admin.bookings.columns.status')}
            </label>
            <select
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value as ComplaintStatus)}
              className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm text-brand-navy outline-none focus:border-brand-navy"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`admin.status.${s}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('admin.complaints.internalNotes')}
            </label>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={3}
              placeholder={t('admin.complaints.internalNotesPlaceholder')}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
            />
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('admin.complaints.resolution')}
            </label>
            <textarea
              value={resolutionDraft}
              onChange={(e) => setResolutionDraft(e.target.value)}
              rows={3}
              placeholder={t('admin.complaints.resolutionPlaceholder')}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
            />
          </div>

          {saveError && (
            <div className="mt-4 rounded-lg border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{saveError}</div>
          )}
          {saved && !saveError && (
            <div className="mt-4 rounded-lg border border-success/25 bg-success-bg px-4 py-3 text-sm text-success">
              {t('admin.complaints.saved')}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="mt-4 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('admin.complaints.saveChanges')}
          </button>
        </Section>

        <div className="lg:col-span-2">
          <Section title={t('admin.complaints.liveChat.sectionTitle')}>
            <p className="text-xs text-text-muted">{t('admin.complaints.liveChat.subtitle')}</p>

            {threadLoading && (
              <div className="mt-4 flex justify-center py-4">
                <Spinner className="h-5 w-5" />
              </div>
            )}

            {threadError && !threadLoading && (
              <div className="mt-4 rounded-lg border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{threadError}</div>
            )}

            {!threadLoading && !threadError && (
              // chatItems is never actually empty in practice — every
              // complaint has a required, non-blank description, which
              // buildDisplayThread always synthesizes as an opening
              // bubble when there's no real complaint_messages row yet.
              <div className="mt-4 flex max-h-96 flex-col gap-2.5 overflow-y-auto rounded-lg border border-brand-navy/10 bg-surface-muted p-3">
                {chatItems.map((message) => (
                  <div
                    key={message.id}
                    className={
                      'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ' +
                      (message.sender === 'admin'
                        ? 'self-end rounded-br-sm bg-brand-navy text-white'
                        : 'self-start rounded-bl-sm bg-white text-brand-navy')
                    }
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      {message.sender === 'admin' ? t('admin.complaints.liveChat.you') : t('admin.complaints.liveChat.customer')}
                    </p>
                    {message.body && <p className="mt-0.5 whitespace-pre-wrap">{message.body}</p>}
                    {message.imagePath &&
                      (imageUrls[message.imagePath] ? (
                        <img src={imageUrls[message.imagePath]} alt="" className="mt-2 max-h-48 rounded-lg border border-black/10" />
                      ) : (
                        <p className="mt-1 text-xs italic opacity-70">{t('admin.complaints.liveChat.photoAttached')}</p>
                      ))}
                    <p className="mt-1 text-[10px] opacity-60">{new Date(message.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}

            {chatSendError && (
              <div className="mt-3 rounded-lg border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{chatSendError}</div>
            )}

            <div className="mt-3 flex gap-2">
              <input
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSendChat()
                }}
                placeholder={t('admin.complaints.liveChat.composerPlaceholder')}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
              />
              <button
                type="button"
                onClick={() => void handleSendChat()}
                disabled={sendingChat || !chatDraft.trim()}
                className="shrink-0 rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {sendingChat ? t('admin.complaints.liveChat.sending') : t('admin.complaints.liveChat.send')}
              </button>
            </div>
          </Section>
        </div>

        <div className="lg:col-span-2">
        <Section title={t('admin.complaints.reply.sectionTitle')}>
          {complaint.admin_reply_sent_at && (
            <p className="text-xs text-text-muted">
              {t('admin.complaints.reply.alreadySentAt', { date: new Date(complaint.admin_reply_sent_at).toLocaleString() })}
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('admin.complaints.reply.label')}
            </label>
            <textarea
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              rows={4}
              placeholder={t('admin.complaints.reply.placeholder')}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
            />
          </div>

          {replyError && <div className="mt-3 rounded-lg border border-error/25 bg-error-bg px-4 py-3 text-sm text-error">{replyError}</div>}
          {replyResult === 'sent' && (
            <div className="mt-3 rounded-lg border border-success/25 bg-success-bg px-4 py-3 text-sm text-success">
              {t('admin.complaints.reply.sent')}
            </div>
          )}
          {replyResult === 'email_failed' && (
            <div className="mt-3 rounded-lg border border-warning/25 bg-warning-bg px-4 py-3 text-sm text-warning">
              {t('admin.complaints.reply.sentButEmailFailed')}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleSendReply()}
            disabled={sendingReply}
            className="mt-4 rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sendingReply ? t('admin.complaints.reply.sending') : t('admin.complaints.reply.send')}
          </button>
        </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
      <h2 className="text-sm font-semibold text-brand-navy">{title}</h2>
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

interface ChatDisplayItem {
  id: string
  sender: 'customer' | 'admin'
  body: string | null
  imagePath: string | null
  createdAt: string
}

/**
 * Merges the real complaint_messages thread with the two older,
 * pre-Support-Chat fields — complaints.description (every complaint has
 * one) and admin_reply_message (only complaints an admin replied to by
 * email) — into one chronological list, so a complaint that predates
 * 20261007000000_support_chat.sql (any Contact Us submission, or an
 * older complaint replied to only by email) still reads as a coherent
 * conversation instead of an empty chat. A chat-originated complaint
 * already has its opening message as a real `thread` row (see
 * start_support_chat_public), so `description` is only synthesized when
 * the thread is otherwise empty — never duplicated alongside it.
 */
function buildDisplayThread(complaint: AdminComplaintWithDetails, thread: AdminComplaintMessage[]): ChatDisplayItem[] {
  const items: ChatDisplayItem[] = thread.map((m) => ({
    id: m.id,
    sender: m.sender,
    body: m.body,
    imagePath: m.image_path,
    createdAt: m.created_at,
  }))

  if (thread.length === 0) {
    items.push({ id: 'synthesized-description', sender: 'customer', body: complaint.description, imagePath: null, createdAt: complaint.created_at })
  }
  if (complaint.admin_reply_message && complaint.admin_reply_sent_at) {
    items.push({
      id: 'synthesized-admin-reply',
      sender: 'admin',
      body: complaint.admin_reply_message,
      imagePath: null,
      createdAt: complaint.admin_reply_sent_at,
    })
  }

  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}
