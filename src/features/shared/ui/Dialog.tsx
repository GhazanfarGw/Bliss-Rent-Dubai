import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Dialogs can nest (the trip editor opens the date and location pickers), so
 * only the most recently opened one may react to the keyboard — otherwise
 * Escape in the picker would close the editor under it as well.
 */
const openDialogs: symbol[] = []

interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Accessible name for the close button — required, not defaulted,
   *  so no English string ships hardcoded inside this shared component;
   *  callers pass their own translated `t('common.close')`-style string. */
  closeLabel: string
  children: ReactNode
  maxWidthClassName?: string
  mobileSheet?: boolean
  /**
   * 'default' (unchanged) is the white card w/ title bar every existing
   * caller uses. 'lightbox' (added for VehicleGallery's photo viewer) is
   * a dark, full-bleed variant with no visible title bar/padding — the
   * accessible name still comes from `title` (kept for screen readers
   * via the same `aria-labelledby`, just visually hidden), so callers
   * don't lose that requirement, they just don't see it rendered.
   *
   * 'sheet' (added for the homepage search bar's phone dropdowns, after the
   * Qatar Airways mobile booking box): a white bottom sheet with rounded top
   * corners that slides up, a title + ✕ row, a scrolling body, an optional
   * pinned `footer`, and page scroll locked underneath. `fullScreen` makes
   * it cover the whole screen instead (used for the calendar).
   */
  variant?: 'default' | 'lightbox' | 'sheet'
  /** 'sheet' only: cover the whole screen instead of sizing to content. */
  fullScreen?: boolean
  /** 'sheet' only: content pinned under the scrolling body (e.g. Clear / Done). */
  footer?: ReactNode
}

/**
 * One accessible modal primitive — `role="dialog"`, `aria-modal`, a
 * focus trap, Escape-to-close, and focus restoration on close —
 * replacing the two ad-hoc `fixed inset-0` overlays found in the Phase
 * 8 audit (the admin mobile-nav drawer, and the Extend-Rental panel),
 * neither of which had any of the above. RTL-safe: uses only logical
 * spacing, no directional classes.
 */
export function Dialog({
  open,
  onClose,
  title,
  closeLabel,
  children,
  maxWidthClassName = 'max-w-lg',
  mobileSheet = false,
  variant = 'default',
  fullScreen = false,
  footer,
}: DialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const stackId = useRef(Symbol('dialog'))

  // Keyed on `open` alone: callers often pass a fresh `onClose` every render, and
  // re-registering then would move this dialog to the top of the stack.
  useEffect(() => {
    if (!open) return
    const id = stackId.current
    openDialogs.push(id)
    return () => {
      const index = openDialogs.indexOf(id)
      if (index >= 0) openDialogs.splice(index, 1)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(firstFocusable ?? panel)?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (openDialogs[openDialogs.length - 1] !== stackId.current) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const nodes = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (!nodes || nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      previouslyFocused.current?.focus()
    }
  }, [open, onClose])

  // A sheet covers most of the phone screen: stop the page behind it from
  // scrolling along with the sheet's own list.
  useEffect(() => {
    if (!open || variant !== 'sheet') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open, variant])

  if (!open) return null

  if (variant === 'sheet') {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <div className="absolute inset-0 bg-brand-navy-dark/50" onClick={onClose} aria-hidden="true" />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={
            'relative z-10 flex w-full flex-col bg-white shadow-[0_-12px_40px_rgba(7,10,26,0.18)] outline-none motion-safe:animate-[sheet-up_260ms_cubic-bezier(0.2,0.8,0.2,1)] ' +
            (fullScreen ? 'h-dvh' : 'max-h-[92dvh] rounded-t-2xl') +
            ' ' +
            maxWidthClassName
          }
        >
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-5">
            <h2 id={titleId} className="min-w-0 break-words text-lg font-medium text-brand-navy">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="-me-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-navy transition-colors hover:bg-brand-lavender focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-[#efece7] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>
          )}
        </div>
      </div>,
      document.body,
    )
  }

  const isLightbox = variant === 'lightbox'

  return createPortal(
    <div className={'fixed inset-0 z-50 flex justify-center p-4 ' + (mobileSheet ? 'items-end sm:items-center' : 'items-center')}>
      <div
        className={'absolute inset-0 ' + (isLightbox ? 'bg-brand-navy-dark/95' : 'bg-brand-navy-dark/50')}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          isLightbox
            ? `relative z-10 max-h-[92vh] w-full max-w-[92vw] outline-none ${maxWidthClassName}`
            : `relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-surface p-6 shadow-md outline-none ${maxWidthClassName}`
        }
      >
        {isLightbox ? (
          <>
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="absolute inset-e-0 top-0 z-20 inline-flex min-h-11 min-w-11 -translate-y-full items-center justify-center text-white/80 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-white sm:translate-y-0"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
            {children}
          </>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id={titleId} className="min-w-0 break-words text-base font-semibold text-brand-navy">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {children}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
