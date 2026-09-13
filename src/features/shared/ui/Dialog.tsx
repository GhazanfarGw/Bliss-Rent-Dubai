import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

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
   */
  variant?: 'default' | 'lightbox'
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
}: DialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(firstFocusable ?? panel)?.focus()

    function handleKeyDown(e: KeyboardEvent) {
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

  if (!open) return null

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
            : `relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-none bg-surface p-6 shadow-md outline-none ${mobileSheet ? 'sm:rounded-none' : ''} ${maxWidthClassName}`
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
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-none p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-gold"
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
