export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
export type ButtonSize = 'default' | 'compact'

/*
 * Phase 8 design system — one button class-builder shared by <Button>
 * and <LinkButton>, replacing the 5+ independently hand-typed button
 * classname strings found across the customer-facing app in the Phase 8
 * audit (different padding scales, inconsistent `disabled:` styling).
 */

// Brand system: primary is always Luxury Berry + white; secondary/outline/
// ghost draw only from Deep Space Blue, white and Platinum Gray. Qatar-style
// theme (2026-09-25): every button is a pill (rounded-full) — the SHAPE
// changed, the colours did not (owner: "do not change buttons bg colors").
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-gold text-white shadow-none hover:brightness-105',
  secondary: 'bg-brand-navy text-white border border-brand-navy shadow-none hover:bg-brand-navy-light',
  outline: 'border border-brand-navy/60 bg-white text-brand-navy shadow-none hover:bg-brand-lavender',
  ghost: 'text-brand-navy shadow-none hover:bg-brand-lavender',
  danger: 'bg-error text-white hover:opacity-90',
  success: 'bg-success text-white hover:opacity-90',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: 'px-6 py-2.75 text-sm',
  compact: 'px-4 py-2 text-sm',
}

export function buttonClass({
  variant = 'primary',
  size = 'default',
  fullWidthOnMobile = false,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidthOnMobile?: boolean
} = {}): string {
  return [
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-semibold tracking-[0.02em] transition-all duration-200 ease-out',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidthOnMobile ? 'w-full sm:w-auto' : '',
  ]
    .filter(Boolean)
    .join(' ')
}
