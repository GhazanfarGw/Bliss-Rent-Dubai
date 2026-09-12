import type { ComponentProps } from 'react'
import { Link } from 'react-router-dom'
import { buttonClass, type ButtonVariant, type ButtonSize } from './buttonClasses'

export interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidthOnMobile?: boolean
}

/** Same visual variants as `Button`, for a navigational CTA (react-router `Link`)
 *  instead of a `<button>` — replacing the gold/navy CTA classnames retyped
 *  independently across the hero, nav, vehicle detail, checkout, and content
 *  pages found in the Phase 8 audit. */
export function LinkButton({
  variant = 'primary',
  size = 'default',
  fullWidthOnMobile = false,
  className = '',
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link className={buttonClass({ variant, size, fullWidthOnMobile }) + (className ? ' ' + className : '')} {...rest}>
      {children}
    </Link>
  )
}
