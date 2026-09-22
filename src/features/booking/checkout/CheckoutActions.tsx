import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'

/** A single responsive action slot supplied by CheckoutStepLayout. */
export const ActionsSlotContext = createContext<HTMLElement | null>(null)

/**
 * Classes for a step's main button so it fits the sticky bar: compact, allowed
 * to wrap onto two lines on a phone (the labels are long — "Confirm & continue
 * to payment"), natural width from `sm` up. Pair with `size="compact"`.
 */
export const ACTION_BUTTON_CLASS = 'min-w-0 flex-1 text-center leading-snug lg:flex-none lg:px-6'

/**
 * A step's buttons. Declared here, next to the form or payment logic they
 * belong to, but drawn once in the layout's responsive action row.
 * Desktop places it below the form; mobile keeps it at the viewport bottom.
 * A submit button reaches its form from there through the `form` attribute.
 * `backTo` adds the Back control: an icon on a phone, "‹ Back" from `sm` up.
 */
export function CheckoutActions({ backTo, backLabel, children }: { backTo?: string; backLabel?: string; children?: ReactNode }) {
  const { t } = useTranslation()
  const slot = useContext(ActionsSlotContext)
  if (!slot) return null

  const label = backLabel ?? t('common.back')
  const content = (
    <>
      {backTo && (
        <Link
          to={backTo}
          className="flex h-11 w-11 shrink-0 items-center justify-center border border-brand-navy/20 text-brand-navy transition-colors hover:bg-brand-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold lg:w-auto lg:gap-1 lg:border-0 lg:px-2 lg:text-text-muted lg:hover:bg-transparent lg:hover:text-brand-navy"
        >
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
          <span className="sr-only text-sm font-semibold lg:not-sr-only">{label}</span>
        </Link>
      )}
      {children}
    </>
  )

  return createPortal(content, slot)
}

/**
 * After a submit from the action slot finds a problem, bring the first invalid
 * field into view and focus it — the button may be far from the field that
 * needs fixing. Fields mark themselves with `aria-invalid` (see FieldShell).
 */
export function revealFirstError() {
  requestAnimationFrame(() => {
    const field = document.querySelector<HTMLElement>('[aria-invalid="true"]')
    field?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    field?.focus({ preventScroll: true })
  })
}
