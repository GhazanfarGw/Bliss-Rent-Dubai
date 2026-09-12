import type { ReactNode } from 'react'

interface StateMessageProps {
  title: string
  body?: string
  action?: ReactNode
  /**
   * Phase 8 added `'success'`, additive — every existing call site only
   * ever passed `'neutral'` or `'error'` (or omitted `tone` for the
   * `'neutral'` default), so this is a pure extension, not a change to
   * either of those two. `'success'` replaces the three independently
   * hand-built "success panel" treatments found in ExtendRentalSection,
   * ConfirmationPage, and ContactPage (Phase 8 audit, section 1.1).
   */
  tone?: 'neutral' | 'error' | 'success'
}

const TONE_CLASSES: Record<NonNullable<StateMessageProps['tone']>, { box: string; title: string; body: string }> = {
  neutral: { box: 'border-brand-gold/10 bg-[#f1eee9]/40', title: 'text-brand-gold', body: 'text-text-muted' },
  error: { box: 'border-error/30 bg-error-bg', title: 'text-error', body: 'text-error' },
  success: { box: 'border-success/30 bg-success-bg', title: 'text-success', body: 'text-success' },
}

/** One consistent look for every loading/empty/error/success state across the site. */
export function StateMessage({ title, body, action, tone = 'neutral' }: StateMessageProps) {
  const classes = TONE_CLASSES[tone]
  return (
    <div className={'mx-auto flex max-w-md flex-col items-center rounded-2xl border px-6 py-12 text-center ' + classes.box}>
      <h3 className={'text-base font-semibold ' + classes.title}>{title}</h3>
      {body && <p className={'mt-2 text-sm ' + classes.body}>{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={'animate-spin text-brand-gold/40 ' + className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}
