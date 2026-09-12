import { useId, type ReactNode } from 'react'

export interface FieldRenderProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

interface FieldShellProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: (fieldProps: FieldRenderProps) => ReactNode
}

/**
 * Shared label/error/hint chrome for every form control. Uses real
 * `htmlFor`/`id` plus `aria-describedby`/`aria-invalid` wiring via
 * `useId()`, replacing the implicit-label-association-only `Field`
 * pattern duplicated across CustomerDetailsPage/DriverDetailsPage/
 * ManageBookingPage/ExtendRentalSection (Phase 8 audit, section 3).
 * RTL-safe by construction — no directional classes are used here.
 */
export function FieldShell({ label, error, hint, required, children }: FieldShellProps) {
  const inputId = useId()
  const errorId = useId()
  const hintId = useId()
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
        <span>{label}</span>
        {required && (
          <span aria-hidden="true" className="text-error">
            *
          </span>
        )}
      </label>
      {children({ id: inputId, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p id={errorId} className="mt-1 text-xs font-medium text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
