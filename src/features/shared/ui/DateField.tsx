import type { InputHTMLAttributes } from 'react'
import { TextField } from './TextField'

export type DateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
  label: string
  error?: string
  hint?: string
  required?: boolean
}

/** A `TextField` fixed to `type="date"` — kept as its own named component
 *  (rather than callers passing `type="date"` themselves) so every date
 *  input in the app shares one place to add a date-specific concern
 *  later (e.g. a min/max helper) without touching every call site. */
export function DateField(props: DateFieldProps) {
  return <TextField {...props} type="date" />
}
