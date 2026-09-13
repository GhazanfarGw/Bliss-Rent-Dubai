import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronDown, Mail, MessageCircle, MessageCircleQuestion, Paperclip, Send, X } from 'lucide-react'
import { Button } from '@/features/shared/ui/Button'
import { SUPPORT_EMAIL_HREF, WHATSAPP_URL } from '@/features/booking/contactLinks'
import {
  SUPPORT_CHAT_ALLOWED_IMAGE_TYPES,
  SUPPORT_CHAT_MAX_IMAGE_BYTES,
  SupportChatApiError,
  fetchSupportChatThread,
  readImageAsBase64,
  sendSupportChatMessage,
  startSupportChat,
  type SupportChatImageInput,
  type SupportChatThreadMessage,
} from '@/features/shared/supportChatApi'
import { readSupportChatSession, storeSupportChatSession, type SupportChatSession } from '@/lib/supportChatStorage'

interface FaqItem {
  question: string
  answer: string
}

interface FaqCategory {
  heading: string
  items: FaqItem[]
}

type ChatMessage = { id: string; from: 'bot' | 'user'; text: string }

type View =
  | { kind: 'topics' }
  | { kind: 'category'; index: number }
  | { kind: 'search'; matches: { categoryIndex: number; itemIndex: number }[] }

type WidgetMode = 'faq' | 'chat'

const EMAIL_RE = /^\S+@\S+\.\S+$/
const CHAT_POLL_INTERVAL_MS = 8000

const fieldClass =
  'w-full border border-border bg-white px-3 py-2.5 text-sm text-brand-navy outline-none transition-colors focus:border-brand-navy focus:ring-1 focus:ring-brand-navy'
const chipClass =
  'min-h-9 border border-brand-gold/60 px-3 py-1.5 text-start text-xs font-semibold text-brand-gold-dark transition-colors hover:bg-brand-gold hover:text-white'
const backChipClass =
  'inline-flex min-h-9 items-center gap-1 border border-brand-navy/30 px-3 py-1.5 text-xs font-semibold text-brand-navy transition-colors hover:bg-brand-lavender'

/**
 * A sticky "Support chat" tab fixed to the bottom trailing corner —
 * FeedbackWidget already owns the vertical-center trailing edge, so this
 * sits lower, clear of it. Two modes, switched by the tab row under the
 * header:
 *
 *  - "Quick answers" (default) — a scripted FAQ chat: topic/question
 *    chips walk a visitor through the exact same content as the full FAQ
 *    page (`pages.faqs.categories`, read via i18next the same way
 *    FaqPage.tsx does) rather than inventing new copy, plus a free-text
 *    box that filters that same list with the same case-insensitive
 *    substring match FaqPage's own search box uses. Nothing here is a
 *    live agent or AI — every reply is one of the fixed FAQ answers.
 *
 *  - "Message our team" — a real, two-way conversation: the visitor's
 *    message (and an optional photo) is sent via the support-chat-start /
 *    support-chat-message Edge Functions, lands in the exact same admin
 *    inbox as the Contact Us form (`complaints`, extended by
 *    complaint_messages — see 20261007000000_support_chat.sql), and an
 *    admin's reply — typed straight into ComplaintDetailPage — shows up
 *    here by polling support-chat-thread every few seconds while this
 *    panel is open. The conversation is identified by an access_token
 *    kept in localStorage (see supportChatStorage.ts), not a login, so it
 *    resumes automatically on a later visit from the same browser.
 *
 * Whichever mode is active, the panel always keeps real direct-contact
 * links (WhatsApp/email, from contactLinks.ts) and a link to the full FAQ
 * page visible below, for anything this can't actually answer.
 *
 * Mounted once in Layout.tsx, public pages only — same as FeedbackWidget
 * and CookieConsentBanner. Non-modal popover behavior (Escape / outside
 * click to dismiss, no focus trap, rest of the page stays interactive)
 * mirrors FeedbackWidget's for the same reason: a persistent tab, not a
 * blocking dialog.
 */
export function SupportChatWidget() {
  const { t, i18n } = useTranslation()
  const titleId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const faqTranscriptRef = useRef<HTMLDivElement>(null)
  const chatTranscriptRef = useRef<HTMLDivElement>(null)
  const startFileInputRef = useRef<HTMLInputElement>(null)
  const composerFileInputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(0)

  const categories = t('pages.faqs.categories', { returnObjects: true }) as FaqCategory[]

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<WidgetMode>(() => (readSupportChatSession() ? 'chat' : 'faq'))

  // --- FAQ mode state -------------------------------------------------
  const [faqTranscript, setFaqTranscript] = useState<ChatMessage[]>([])
  const [view, setView] = useState<View>({ kind: 'topics' })
  const [query, setQuery] = useState('')

  // --- Live chat mode state --------------------------------------------
  const [session, setSession] = useState<SupportChatSession | null>(() => readSupportChatSession())
  const [chatMessages, setChatMessages] = useState<SupportChatThreadMessage[]>([])
  const [chatConversationStatus, setChatConversationStatus] = useState<string | null>(null)
  const [chatLoadError, setChatLoadError] = useState<string | null>(null)

  const [startName, setStartName] = useState('')
  const [startEmail, setStartEmail] = useState('')
  const [startMessage, setStartMessage] = useState('')
  const [startImage, setStartImage] = useState<File | null>(null)
  const [startErrors, setStartErrors] = useState<Record<string, string>>({})
  const [starting, setStarting] = useState(false)

  const [composerText, setComposerText] = useState('')
  const [composerImage, setComposerImage] = useState<File | null>(null)
  const [composerError, setComposerError] = useState<string | null>(null)
  const [sendingMessage, setSendingMessage] = useState(false)

  function pushFaqMessage(from: ChatMessage['from'], text: string) {
    nextId.current += 1
    setFaqTranscript((prev) => [...prev, { id: `m${nextId.current}`, from, text }])
  }

  // Re-seeds the scripted FAQ conversation whenever the locale changes
  // (including the initial mount) — otherwise earlier bubbles would stay
  // frozen in the old language while new chips render in the new one.
  // The live chat thread is untouched by this — it lives server-side,
  // keyed by access_token, not by UI language.
  useEffect(() => {
    nextId.current = 0
    setFaqTranscript([{ id: 'm0', from: 'bot', text: t('supportChat.greeting') }])
    setView({ kind: 'topics' })
    setQuery('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language])

  useEffect(() => {
    if (!faqTranscriptRef.current) return
    faqTranscriptRef.current.scrollTop = faqTranscriptRef.current.scrollHeight
  }, [faqTranscript])

  useEffect(() => {
    if (!chatTranscriptRef.current) return
    chatTranscriptRef.current.scrollTop = chatTranscriptRef.current.scrollHeight
  }, [chatMessages])

  async function refreshThread(accessToken: string) {
    try {
      const result = await fetchSupportChatThread(accessToken)
      setChatMessages(result.messages)
      setChatConversationStatus(result.status)
      setChatLoadError(null)
    } catch (err) {
      setChatLoadError(err instanceof SupportChatApiError ? err.message : t('supportChat.chat.loadError'))
    }
  }

  // Polls for an admin's reply while the panel is open and in chat mode —
  // this (not a realtime channel) is how ComplaintDetailPage's reply box
  // reaches this widget.
  useEffect(() => {
    if (!open || mode !== 'chat' || !session) return
    void refreshThread(session.accessToken)
    const intervalId = window.setInterval(() => void refreshThread(session.accessToken), CHAT_POLL_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, session?.accessToken])

  function handleClose() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>('button, input, textarea, [href]')
    firstFocusable?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // --- FAQ mode handlers ------------------------------------------------

  function selectCategory(index: number) {
    const category = categories[index]
    pushFaqMessage('user', category.heading)
    pushFaqMessage('bot', t('supportChat.categoryIntro', { category: category.heading }))
    setView({ kind: 'category', index })
  }

  function selectQuestion(categoryIndex: number, itemIndex: number) {
    const item = categories[categoryIndex].items[itemIndex]
    pushFaqMessage('user', item.question)
    pushFaqMessage('bot', item.answer)
    setView({ kind: 'category', index: categoryIndex })
  }

  function backToTopics() {
    setView({ kind: 'topics' })
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    pushFaqMessage('user', q)
    setQuery('')

    const needle = q.toLowerCase()
    const matches: { categoryIndex: number; itemIndex: number }[] = []
    categories.forEach((category, categoryIndex) => {
      category.items.forEach((item, itemIndex) => {
        if (item.question.toLowerCase().includes(needle) || item.answer.toLowerCase().includes(needle)) {
          matches.push({ categoryIndex, itemIndex })
        }
      })
    })

    if (matches.length === 0) {
      pushFaqMessage('bot', t('supportChat.noResultsBody'))
      setView({ kind: 'topics' })
    } else {
      pushFaqMessage('bot', t('supportChat.searchIntro', { query: q }))
      setView({ kind: 'search', matches: matches.slice(0, 6) })
    }
  }

  // --- Live chat mode handlers -------------------------------------------

  function validateImageFile(file: File): string | null {
    if (!SUPPORT_CHAT_ALLOWED_IMAGE_TYPES.includes(file.type)) return t('supportChat.chat.errorImageType')
    if (file.size > SUPPORT_CHAT_MAX_IMAGE_BYTES) return t('supportChat.chat.errorImageSize')
    return null
  }

  function handleStartFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!file) return
    const error = validateImageFile(file)
    setStartErrors((prev) => {
      const next = { ...prev }
      if (error) next.image = error
      else delete next.image
      return next
    })
    setStartImage(error ? null : file)
  }

  function handleComposerFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!file) return
    const error = validateImageFile(file)
    if (error) {
      setComposerError(error)
      return
    }
    setComposerError(null)
    setComposerImage(file)
  }

  async function toImageInput(file: File | null): Promise<SupportChatImageInput | undefined> {
    if (!file) return undefined
    const imageBase64 = await readImageAsBase64(file)
    return { imageBase64, imageMimeType: file.type }
  }

  async function handleStartSubmit(e: FormEvent) {
    e.preventDefault()
    const name = startName.trim()
    const email = startEmail.trim()
    const message = startMessage.trim()
    const errors: Record<string, string> = {}
    if (!name) errors.fullName = t('supportChat.chat.errorName')
    if (!EMAIL_RE.test(email)) errors.email = t('supportChat.chat.errorEmail')
    if (!message && !startImage) errors.message = t('supportChat.chat.errorMessage')
    setStartErrors(errors)
    if (Object.keys(errors).length > 0) return

    setStarting(true)
    try {
      const image = await toImageInput(startImage)
      const result = await startSupportChat({ fullName: name, email, message, image })
      const newSession: SupportChatSession = { accessToken: result.accessToken, complaintId: result.complaintId, name, email }
      storeSupportChatSession(newSession)
      // Setting `session` alone is enough to fetch the thread — the poll
      // effect below re-runs on `session.accessToken` changing (session
      // just went from null to this), so it fires immediately.
      setSession(newSession)
      setStartMessage('')
      setStartImage(null)
    } catch (err) {
      if (err instanceof SupportChatApiError && err.fieldErrors) {
        setStartErrors(err.fieldErrors)
      } else {
        setStartErrors({ submit: err instanceof Error ? err.message : t('supportChat.chat.errorSubmit') })
      }
    } finally {
      setStarting(false)
    }
  }

  async function handleComposerSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    const text = composerText.trim()
    if (!text && !composerImage) {
      setComposerError(t('supportChat.chat.errorMessage'))
      return
    }

    setSendingMessage(true)
    setComposerError(null)
    try {
      const image = await toImageInput(composerImage)
      await sendSupportChatMessage({ accessToken: session.accessToken, message: text, image })
      setComposerText('')
      setComposerImage(null)
      void refreshThread(session.accessToken)
    } catch (err) {
      setComposerError(err instanceof SupportChatApiError ? err.message : t('supportChat.chat.errorSubmit'))
    } finally {
      setSendingMessage(false)
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-5 inset-e-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="pointer-events-auto flex max-h-[75vh] w-[min(92vw,24rem)] flex-col overflow-hidden border border-[#ece7df] bg-white shadow-[0_20px_45px_rgba(15,18,22,0.2)]"
        >
          <div className="flex items-center justify-between bg-brand-gold px-4 py-3">
            <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-white">
              <MessageCircleQuestion className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t('supportChat.title')}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              aria-label={t('common.close')}
              className="inline-flex min-h-8 min-w-8 items-center justify-center text-white/85 transition-colors hover:text-white"
            >
              <ChevronDown className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex border-b border-[#ece7df]">
            <button
              type="button"
              onClick={() => setMode('faq')}
              className={
                'flex-1 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ' +
                (mode === 'faq' ? 'bg-brand-gold text-white' : 'bg-white text-text-muted hover:bg-brand-lavender/60')
              }
            >
              {t('supportChat.modeFaqLabel')}
            </button>
            <button
              type="button"
              onClick={() => setMode('chat')}
              className={
                'flex-1 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ' +
                (mode === 'chat' ? 'bg-brand-gold text-white' : 'bg-white text-text-muted hover:bg-brand-lavender/60')
              }
            >
              {t('supportChat.modeChatLabel')}
            </button>
          </div>

          {mode === 'faq' ? (
            <>
              <div ref={faqTranscriptRef} role="log" aria-live="polite" className="flex-1 space-y-2.5 overflow-y-auto p-4">
                {faqTranscript.map((message) => (
                  <p
                    key={message.id}
                    className={
                      'max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ' +
                      (message.from === 'bot' ? 'bg-brand-lavender text-brand-navy' : 'ms-auto bg-brand-gold text-white')
                    }
                  >
                    {message.text}
                  </p>
                ))}
              </div>

              <div className="border-t border-[#ece7df] p-3">
                <div className="flex flex-wrap gap-2">
                  {view.kind === 'topics' &&
                    categories.map((category, index) => (
                      <button key={category.heading} type="button" onClick={() => selectCategory(index)} className={chipClass}>
                        {category.heading}
                      </button>
                    ))}

                  {view.kind === 'category' && (
                    <>
                      <button type="button" onClick={backToTopics} className={backChipClass}>
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('common.back')}
                      </button>
                      {categories[view.index].items.map((item, itemIndex) => (
                        <button
                          key={item.question}
                          type="button"
                          onClick={() => selectQuestion(view.index, itemIndex)}
                          className={chipClass}
                        >
                          {item.question}
                        </button>
                      ))}
                    </>
                  )}

                  {view.kind === 'search' && (
                    <>
                      <button type="button" onClick={backToTopics} className={backChipClass}>
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('common.back')}
                      </button>
                      {view.matches.map(({ categoryIndex, itemIndex }) => {
                        const item = categories[categoryIndex].items[itemIndex]
                        return (
                          <button
                            key={`${categoryIndex}-${itemIndex}`}
                            type="button"
                            onClick={() => selectQuestion(categoryIndex, itemIndex)}
                            className={chipClass}
                          >
                            {item.question}
                          </button>
                        )
                      })}
                    </>
                  )}
                </div>

                <form onSubmit={handleSearchSubmit} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('supportChat.inputPlaceholder')}
                    aria-label={t('supportChat.inputAriaLabel')}
                    className={fieldClass}
                  />
                  <Button type="submit" aria-label={t('supportChat.send')} className="shrink-0 px-3">
                    <Send className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </form>
              </div>
            </>
          ) : !session ? (
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-sm text-text-muted">{t('supportChat.chat.startIntro')}</p>
              <form onSubmit={(e) => void handleStartSubmit(e)} noValidate className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t('supportChat.chat.nameLabel')}
                  </span>
                  <input value={startName} onChange={(e) => setStartName(e.target.value)} autoComplete="name" className={fieldClass} />
                  {startErrors.fullName && <p className="mt-1 text-xs text-error">{startErrors.fullName}</p>}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t('supportChat.chat.emailLabel')}
                  </span>
                  <input
                    type="email"
                    value={startEmail}
                    onChange={(e) => setStartEmail(e.target.value)}
                    autoComplete="email"
                    className={fieldClass}
                  />
                  {startErrors.email && <p className="mt-1 text-xs text-error">{startErrors.email}</p>}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t('supportChat.chat.messageLabel')}
                  </span>
                  <textarea
                    value={startMessage}
                    onChange={(e) => setStartMessage(e.target.value)}
                    rows={3}
                    placeholder={t('supportChat.chat.messagePlaceholder')}
                    className={fieldClass}
                  />
                  {startErrors.message && <p className="mt-1 text-xs text-error">{startErrors.message}</p>}
                </label>

                {startImage && (
                  <span className="inline-flex w-fit max-w-full items-center gap-1.5 border border-brand-navy/20 bg-white px-2.5 py-1 text-xs text-brand-navy">
                    <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{startImage.name}</span>
                    <button
                      type="button"
                      onClick={() => setStartImage(null)}
                      aria-label={t('supportChat.chat.removeAttachment')}
                      className="ms-1 shrink-0 text-text-muted hover:text-brand-navy"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                )}
                {startErrors.image && <p className="text-xs text-error">{startErrors.image}</p>}

                <input
                  ref={startFileInputRef}
                  type="file"
                  accept={SUPPORT_CHAT_ALLOWED_IMAGE_TYPES.join(',')}
                  className="hidden"
                  onChange={handleStartFileChange}
                />
                <button
                  type="button"
                  onClick={() => startFileInputRef.current?.click()}
                  className="inline-flex min-h-9 items-center gap-1.5 border border-border bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy transition-colors hover:bg-brand-lavender"
                >
                  <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('supportChat.chat.attachButton')}
                </button>

                {startErrors.submit && <p className="text-xs text-error">{startErrors.submit}</p>}

                <Button type="submit" loading={starting} className="w-full">
                  {starting ? t('supportChat.chat.starting') : t('supportChat.chat.startSubmit')}
                </Button>
              </form>
            </div>
          ) : (
            <>
              <div ref={chatTranscriptRef} role="log" aria-live="polite" className="flex-1 space-y-2.5 overflow-y-auto p-4">
                {(chatConversationStatus === 'resolved' || chatConversationStatus === 'closed') && (
                  <p className="border border-brand-lavender bg-brand-lavender/30 px-3 py-2 text-xs text-text-muted">
                    {t('supportChat.chat.statusResolved')}
                  </p>
                )}
                {chatLoadError && <p className="text-xs text-error">{chatLoadError}</p>}
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      'max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ' +
                      (message.sender === 'admin' ? 'bg-brand-lavender text-brand-navy' : 'ms-auto bg-brand-gold text-white')
                    }
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      {message.sender === 'admin' ? t('supportChat.chat.ourTeam') : t('supportChat.chat.you')}
                    </p>
                    {message.body && <p className="mt-0.5 whitespace-pre-wrap">{message.body}</p>}
                    {message.imageUrl && (
                      <img src={message.imageUrl} alt="" className="mt-2 max-h-48 max-w-full border border-white/20" />
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-[#ece7df] p-3">
                {composerError && <p className="mb-2 text-xs text-error">{composerError}</p>}
                {composerImage && (
                  <span className="mb-2 inline-flex w-fit max-w-full items-center gap-1.5 border border-brand-navy/20 bg-white px-2.5 py-1 text-xs text-brand-navy">
                    <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{composerImage.name}</span>
                    <button
                      type="button"
                      onClick={() => setComposerImage(null)}
                      aria-label={t('supportChat.chat.removeAttachment')}
                      className="ms-1 shrink-0 text-text-muted hover:text-brand-navy"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                )}
                <form onSubmit={(e) => void handleComposerSubmit(e)} className="flex gap-2">
                  <input
                    ref={composerFileInputRef}
                    type="file"
                    accept={SUPPORT_CHAT_ALLOWED_IMAGE_TYPES.join(',')}
                    className="hidden"
                    onChange={handleComposerFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => composerFileInputRef.current?.click()}
                    aria-label={t('supportChat.chat.attachButton')}
                    className="shrink-0 border border-border bg-white px-3 text-brand-navy transition-colors hover:bg-brand-lavender"
                  >
                    <Paperclip className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <input
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    placeholder={t('supportChat.chat.composerPlaceholder')}
                    aria-label={t('supportChat.chat.composerPlaceholder')}
                    className={fieldClass}
                  />
                  <Button type="submit" loading={sendingMessage} aria-label={t('supportChat.chat.send')} className="shrink-0 px-3">
                    <Send className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </form>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#ece7df] bg-surface-warm-alt px-4 py-2.5 text-xs text-text-muted">
            <span>{t('supportChat.contactPrompt')}</span>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-brand-navy hover:text-brand-gold-dark"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {t('pages.contact.methods.whatsapp.label')}
            </a>
            <a
              href={SUPPORT_EMAIL_HREF}
              className="inline-flex items-center gap-1 font-semibold text-brand-navy hover:text-brand-gold-dark"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              {t('pages.contact.methods.email.label')}
            </a>
            <Link to="/faqs" className="font-semibold text-brand-navy underline-offset-4 hover:underline">
              {t('supportChat.viewAllFaqs')}
            </Link>
          </div>
        </div>
      )}

      {/* Round, icon-only FAB (matching the reference airline site's own
          corner bubble) — the label lives in a hover/focus tooltip
          instead of sitting permanently next to the icon, plus an
          aria-label so it's still named for assistive tech. */}
      <div className="group/trigger pointer-events-auto relative">
        <span
          role="tooltip"
          className="pointer-events-none absolute inset-e-full top-1/2 me-3 -translate-y-1/2 whitespace-nowrap bg-brand-gold-dark px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/trigger:opacity-100 group-focus-within/trigger:opacity-100"
        >
          {t('supportChat.buttonLabel')}
        </span>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t('supportChat.buttonLabel')}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-gold text-white shadow-[0_8px_24px_rgba(92,9,49,0.35)] transition-all hover:brightness-110"
        >
          <MessageCircleQuestion className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
