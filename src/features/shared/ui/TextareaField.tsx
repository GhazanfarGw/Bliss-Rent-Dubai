import type { TextareaHTMLAttributes } from 'react'
import { FieldShell } from './FieldShell'
import { inputClass } from './inputClasses'

export interface TextareaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string
  error?: string
  hint?: string
  required?: boolean
}

export function TextareaField({ label, error, hint, required, className = '', rows = 4, ...rest }: TextareaFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required}>
      {(fieldProps) => (
        <textarea
          {...rest}
          {...fieldProps}
          required={required}
          rows={rows}
          className={inputClass({ invalid: !!error }) + ' resize-y' + (className ? ' ' + className : '')}
        />
      )}
    </FieldShell>
  )
}
