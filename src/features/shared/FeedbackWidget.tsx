import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Star } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/features/shared/ui/Button'

type SubmitStatus = 'idle' | 'sending' | 'sent'

/**
 * A sticky "Feedback" tab fixed to the vertical center of the viewport —
 * the same always-there pattern airline sites like Qatar Airways use.
 * Clicking it opens a compact panel anchored right next to the tab (not
 * a full-screen centered modal, and with no dark backdrop) — matching
 * that reference site's own widget: a colored header bar with a
 * collapse control, and the form directly below it. The rest of the
 * page stays visible and interactive behind it, same as Qatar's.
 *
 * Mounted once in Layout.tsx (public pages only, same as
 * CookieConsentBanner); the admin dashboard gets its own read-only view
 * of the results at /admin/feedback instead of the widget itself.
 *
 * `inset-e-0` / `justify-end` (not `right-0` / a fixed side) so the tab
 * and panel sit on the true trailing edge in both languages — the
 * reading edge in English, mirrored to the left in Arabic — matching
 * every other fixed/positioned element in this RTL-aware codebase.
 *
 * Submission is anonymous by design (see submit-feedback Edge Function /
 * site_feedback table) — no name or email is asked for, so there is
 * nothing to validate beyond "a rating was chosen". Kept to exactly that
 * (a star rating + an optional message) rather than Qatar's own
 * multi-step "what would you like to share" flow — that branching
 * category picker was never asked for, and one clear question beats
 * routing a visitor through steps that don't apply to this site.
 */
export function FeedbackWidget() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const titleId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [error, setError] = useState('')

  function resetForm() {
    setRating(0)
    setHoverRating(0)
    setMessage('')
    setStatus('idle')
    setError('')
  }

  function handleClose() {
    setOpen(false)
    // Only wipe the form once a submission has actually gone through — an
    // idle close (visitor changed their mind mid-typing, or clicked away)
    // keeps the draft so reopening the panel doesn't lose it.
    if (status === 'sent') resetForm()
    triggerRef.current?.focus()
  }

  // Non-modal popover conventions: Escape closes it, and so does clicking
  // anywhere outside the panel/tab — the page behind stays interactive,
  // it never gets a focus trap like the shared modal Dialog does.
  useEffect(() => {
    if (!open) return
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>('button, textarea, [href]')
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (rating < 1) {
      setError(t('feedback.errorRating'))
      return
    }

    setStatus('sending')
    setError('')
    try {
      const { error: invokeError } = await supabase.functions.invoke('submit-feedback', {
        body: { rating, message: message.trim(), pagePath: location.pathname, locale: i18n.language },
      })
      if (invokeError) throw invokeError
      setStatus('sent')
    } catch {
      setStatus('idle')
      setError(t('feedback.errorSubmit'))
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-1/2 z-40 flex -translate-y-1/2 items-center justify-end">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="pointer-events-auto me-0 w-[min(90vw,22rem)] overflow-hidden border border-[#ece7df] bg-white shadow-[0_20px_45px_rgba(15,18,22,0.2)]"
        >
          <div className="flex items-center justify-between bg-brand-gold px-4 py-3">
            <h2 id={titleId} className="text-sm font-semibold text-white">
              {t('feedback.title')}
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

          <div className="max-h-[70vh] overflow-y-auto p-5">
            {status === 'sent' ? (
              <div className="py-2 text-center">
                <p className="text-sm font-semibold text-brand-navy">{t('feedback.thankYouTitle')}</p>
                <p className="mt-2 text-sm text-text-muted">{t('feedback.thankYouBody')}</p>
                <Button className="mt-5 w-full" onClick={handleClose}>
                  {t('common.close')}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <p className="text-sm text-text-muted">{t('feedback.subtitle')}</p>

                <div
                  className="mt-5 flex items-center justify-center gap-1.5"
                  role="radiogroup"
                  aria-label={t('feedback.ratingLabel')}
                >
                  {[1, 2, 3, 4, 5].map((value) => {
                    const filled = value <= (hoverRating || rating)
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={rating === value}
                        aria-label={t('feedback.starLabel', { count: value })}
                        onMouseEnter={() => setHoverRating(value)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => {
                          setRating(value)
                          setError('')
                        }}
                        className="p-1"
                      >
                        <Star
                          className={
                            'h-8 w-8 transition-colors ' +
                            (filled ? 'fill-brand-champagne text-brand-champagne' : 'text-border')
                          }
                          aria-hidden="true"
                        />
                      </button>
                    )
                  })}
                </div>

                <label className="mt-5 block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t('feedback.messageLabel')}
                  </span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder={t('feedback.messagePlaceholder')}
                    className="w-full rounded-none border border-border bg-white px-3 py-2.5 text-sm text-brand-navy outline-none transition-colors focus:border-brand-navy focus:ring-1 focus:ring-brand-navy"
                  />
                </label>

                {error && <p className="mt-3 text-xs text-error">{error}</p>}

                <Button type="submit" loading={status === 'sending'} className="mt-5 w-full">
                  {status === 'sending' ? t('feedback.sending') : t('feedback.submit')}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="pointer-events-auto flex shrink-0 flex-col items-center gap-2 rounded-none bg-brand-gold px-2 py-3.5 text-white shadow-[0_8px_24px_rgba(92,9,49,0.35)] transition-all hover:brightness-105"
      >
        <Star className="h-4 w-4 shrink-0 fill-white" aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] [writing-mode:vertical-rl] rotate-180">
          {t('feedback.buttonLabel')}
        </span>
      </button>
    </div>
  )
}
