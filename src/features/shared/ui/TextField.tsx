import type { InputHTMLAttributes } from 'react'
import { FieldShell } from './FieldShell'
import { inputClass } from './inputClasses'

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: string
  hint?: string
  required?: boolean
}

export function TextField({ label, error, hint, required, className = '', ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {(fieldProps) => (
        <input
          {...rest}
          {...fieldProps}
          required={required}
          className={inputClass({ invalid: !!error }) + (className ? ' ' + className : '')}
        />
      )}
    </FieldShell>
  )
}
