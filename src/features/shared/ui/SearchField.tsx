import { useId, type InputHTMLAttributes } from 'react'
import { inputClass } from './inputClasses'

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: string
  /** Visually hides the label (kept in the DOM for screen readers) — for
   *  the common "search" input next to a filter bar where a placeholder
   *  already communicates purpose. Every SearchField still has a real
   *  accessible name; this only controls whether it's also visible. */
  hideLabel?: boolean
}

/** A labeled `type="search"` input — every admin list-page search box
 *  audited in Phase 8 rendered a bare `<input>` with no associated
 *  label at all; this gives every one a real accessible name. */
export function SearchField({ label, hideLabel = false, className = '', ...rest }: SearchFieldProps) {
  const id = useId()
  return (
    <div>
      <label
        htmlFor={id}
        className={hideLabel ? 'sr-only' : 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted'}
      >
        {label}
      </label>
      <input id={id} type="search" className={inputClass() + (className ? ' ' + className : '')} {...rest} />
    </div>
  )
}
