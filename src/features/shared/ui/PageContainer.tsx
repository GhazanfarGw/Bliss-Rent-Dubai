import type { ReactNode } from 'react'

const MAX_WIDTH_CLASSES = {
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
  '2xl': 'max-w-6xl',
} as const

interface PageContainerProps {
  children: ReactNode
  maxWidth?: keyof typeof MAX_WIDTH_CLASSES
  className?: string
}

/** The shared max-width/padding wrapper (`mx-auto ... px-4 py-8 sm:px-6
 *  lg:px-8`) already used ad hoc by the checkout flow and several
 *  homepage sections — centralized so future pages reach for one
 *  constant instead of retyping the class string. */
export function PageContainer({ children, maxWidth = '2xl', className = '' }: PageContainerProps) {
  return <div className={`mx-auto px-4 py-8 sm:px-6 lg:px-8 ${MAX_WIDTH_CLASSES[maxWidth]} ${className}`}>{children}</div>
}
