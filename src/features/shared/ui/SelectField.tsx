import type { SelectHTMLAttributes, ReactNode } from 'react'
import { FieldShell } from './FieldShell'
import { inputClass } from './inputClasses'

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

export function SelectField({ label, error, hint, required, children, className = '', ...rest }: SelectFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {(fieldProps) => (
        <select
          {...rest}
          {...fieldProps}
          required={required}
          className={inputClass({ invalid: !!error }) + ' pe-8' + (className ? ' ' + className : '')}
        >
          {children}
        </select>
      )}
    </FieldShell>
  )
}
