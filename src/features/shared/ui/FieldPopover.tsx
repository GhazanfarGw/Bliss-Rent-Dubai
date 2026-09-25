import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Dialog } from '@/features/shared/ui/Dialog'
import { useMediaQuery } from '@/lib/useMediaQuery'

interface FieldPopoverProps {
  open: boolean
  onClose: () => void
  /** Accessible name (desktop) and visible sheet title (mobile). */
  title: string
  closeLabel: string
  /** The field this dropdown belongs to — positioned under it, and clicks on it don't count as "outside". */
  anchorRef: RefObject<HTMLElement | null>
  /** Which edge of the anchor the panel lines up with (logical: flips in RTL). */
  align?: 'start' | 'end'
  /** Desktop panel width, e.g. `w-[26rem]`. */
  widthClassName?: string
  /** Mobile sheet max width (passed to Dialog). */
  sheetMaxWidthClassName?: string
  /** Phones: cover the whole screen (the calendar) instead of a content-sized bottom sheet. */
  mobileFullScreen?: boolean
  /** Phones: content pinned to the bottom of the sheet (e.g. Clear / Done). */
  mobileFooter?: ReactNode
  children: ReactNode
}

/** Gap between the field and its dropdown, and the minimum distance kept from the viewport edge. */
const OFFSET = 8
const EDGE = 16

/**
 * Qatar-Airways-style field dropdown for the homepage search bar: on desktop
 * (lg+) a white panel that opens directly under its field, closes on an
 * outside click or Escape, and lets ArrowUp/ArrowDown move between
 * `[data-option]` rows. Below lg it behaves like Qatar's phone booking box
 * instead: the same content in a bottom sheet that slides up over a dimmed
 * page (Dialog variant="sheet"), or a full-screen one for the calendar.
 *
 * Portaled to <body> with `position: fixed`, re-placed under its field on
 * every scroll (page or a scrolling popup) and resize, so it is never
 * clipped by the card around the fields. On the page it sits at z-30,
 * under the fixed z-40 header; inside a popup (Dialog, z-50) it goes above
 * it, and Escape / the first outside click close only this dropdown, not
 * the popup behind it.
 */
export function FieldPopover({
  open,
  onClose,
  title,
  closeLabel,
  anchorRef,
  align = 'start',
  widthClassName = 'w-[26rem]',
  sheetMaxWidthClassName = 'max-w-xl',
  mobileFullScreen = false,
  mobileFooter,
  children,
}: FieldPopoverProps) {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const panelRef = useRef<HTMLDivElement>(null)
  const sheetContentRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; inDialog: boolean } | null>(null)

  useLayoutEffect(() => {
    // A stale position from the last opening is fine: this re-places the
    // panel before the browser paints.
    if (!open || !desktop) return
    function place() {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor || !panel) return
      const rect = anchor.getBoundingClientRect()
      const width = panel.offsetWidth
      const rtl = getComputedStyle(anchor).direction === 'rtl'
      const alignRight = (align === 'end') !== rtl
      const viewport = document.documentElement.clientWidth
      const left = Math.max(EDGE, Math.min(alignRight ? rect.right - width : rect.left, viewport - width - EDGE))
      // Open downward; flip above the field when it only fits there; if it
      // fits neither way, keep it fully on screen (it may cover the field).
      const height = panel.offsetHeight
      const viewportH = window.innerHeight
      let top = rect.bottom + OFFSET
      if (top + height > viewportH - EDGE) {
        const above = rect.top - OFFSET - height
        top = above >= EDGE ? above : Math.max(EDGE, viewportH - height - EDGE)
      }
      setPos({ top, left, inDialog: !!anchor.closest('[role="dialog"]') })
    }
    place()
    window.addEventListener('resize', place)
    // Capture: also hears scrolls of inner containers (e.g. a popup's body).
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, desktop, align, anchorRef])

  // Callers pass a fresh `onClose` every render; read it through a ref so the
  // effect below runs once per opening (it moves focus into the panel).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open || !desktop) return
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>('[data-option][data-selected]')
    ;(first ?? panel)?.focus({ preventScroll: true })

    let swallowTimer: number | undefined
    function swallowClick(e: MouseEvent) {
      e.stopPropagation()
      e.preventDefault()
    }
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onCloseRef.current()
      // Inside a popup, a tap on its dimmed backdrop should only close this
      // dropdown — swallow the click that would also close the popup.
      const popup = anchorRef.current?.closest('[role="dialog"]')
      if (popup && !popup.contains(target)) {
        window.addEventListener('click', swallowClick, { capture: true, once: true })
        swallowTimer = window.setTimeout(() => window.removeEventListener('click', swallowClick, true), 600)
      }
    }
    // Window capture runs before the popup Dialog's document-level handler,
    // so Escape closes only this dropdown.
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCloseRef.current()
      anchorRef.current?.querySelector<HTMLElement>('button')?.focus()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.clearTimeout(swallowTimer)
    }
  }, [open, desktop, anchorRef])

  // Long lists (e.g. 48 pickup times) open scrolled to the current choice.
  useEffect(() => {
    if (open) scrollSelectedIntoView(desktop ? panelRef.current : sheetContentRef.current)
  }, [open, desktop])

  if (!open) return null

  if (!desktop) {
    return (
      <Dialog
        open
        onClose={onClose}
        title={title}
        closeLabel={closeLabel}
        variant="sheet"
        fullScreen={mobileFullScreen}
        footer={mobileFooter}
        maxWidthClassName={sheetMaxWidthClassName}
      >
        <div ref={sheetContentRef} onKeyDown={moveBetweenOptions}>
          {children}
        </div>
      </Dialog>
    )
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={moveBetweenOptions}
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0 }}
      className={
        'fixed rounded-xl border border-[#e6e3de] bg-white shadow-[0_18px_50px_rgba(11,19,43,0.16)] outline-none ' +
        (pos?.inDialog ? 'z-60 ' : 'z-30 ') +
        widthClassName +
        // Transparent (not `invisible`) until placed, so it can already take focus.
        (pos ? '' : ' pointer-events-none opacity-0')
      }
    >
      {children}
    </div>,
    document.body,
  )
}

/**
 * Centres the `[data-option][data-selected]` row inside its nearest scrolling
 * container — the list itself on desktop, the sheet body on phones — never
 * looking past the dropdown's own dialog, so the page itself doesn't move.
 */
function scrollSelectedIntoView(root: HTMLElement | null) {
  const selected = root?.querySelector<HTMLElement>('[data-option][data-selected]')
  if (!selected) return
  for (let p = selected.parentElement; p; p = p.parentElement) {
    if (p.scrollHeight > p.clientHeight + 1 && getComputedStyle(p).overflowY !== 'visible') {
      const offset = selected.getBoundingClientRect().top - p.getBoundingClientRect().top
      p.scrollTop += offset - (p.clientHeight - selected.offsetHeight) / 2
      return
    }
    if (p.getAttribute('role') === 'dialog') return
  }
}

/** ArrowUp/ArrowDown between the `[data-option]` rows of a list. */
function moveBetweenOptions(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  const current = (e.target as HTMLElement).closest<HTMLElement>('[data-option]')
  const options = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-option]'))
  if (options.length === 0) return
  e.preventDefault()
  const index = current ? options.indexOf(current) : -1
  const next = e.key === 'ArrowDown' ? options[Math.min(index + 1, options.length - 1)] : options[Math.max(index - 1, 0)]
  next?.focus()
}
