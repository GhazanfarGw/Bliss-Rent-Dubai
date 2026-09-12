import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from '@/features/shared/StateMessage'
import { buttonClass, type ButtonVariant, type ButtonSize } from './buttonClasses'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidthOnMobile?: boolean
}

/**
 * The one shared button primitive for native `<button>` actions —
 * `LinkButton` covers the same variants for react-router navigation.
 * `loading` disables the button and shows the existing shared `Spinner`
 * instead of introducing a second spinner implementation.
 */
export function Button({
  variant = 'primary',
  size = 'default',
  loading = false,
  fullWidthOnMobile = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, fullWidthOnMobile }) + (className ? ' ' + className : '')}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}
