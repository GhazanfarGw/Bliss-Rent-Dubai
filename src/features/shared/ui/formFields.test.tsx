import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TextField } from './TextField'
import { SelectField } from './SelectField'
import { TextareaField } from './TextareaField'
import { DateField } from './DateField'
import { SearchField } from './SearchField'

describe('TextField', () => {
  it('associates the label with the input via a real htmlFor/id pair', () => {
    render(<TextField label="Full name" value="" onChange={() => {}} />)
    const input = screen.getByLabelText('Full name')
    expect(input.tagName).toBe('INPUT')
  })

  it('wires an error message via aria-describedby and aria-invalid', () => {
    render(<TextField label="Email" value="" onChange={() => {}} error="Enter a valid email" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)).toHaveTextContent('Enter a valid email')
  })

  it('shows a required marker and sets the native required attribute', () => {
    render(<TextField label="Phone" value="" onChange={() => {}} required />)
    // testing-library's getByLabelText matches the label's full text
    // content, including the visually-required "*" marker (which is
    // aria-hidden — screen readers announce required state from the
    // native `required` attribute below, not from this glyph).
    expect(screen.getByLabelText(/phone/i)).toBeRequired()
  })
})

describe('SelectField', () => {
  it('renders passed options and associates the label', () => {
    render(
      <SelectField label="Payment method" value="online" onChange={() => {}}>
        <option value="online">Online</option>
        <option value="cash">Cash</option>
      </SelectField>,
    )
    const select = screen.getByLabelText('Payment method') as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    expect(screen.getByRole('option', { name: 'Cash' })).toBeInTheDocument()
  })
})

describe('TextareaField', () => {
  it('renders a labeled textarea', () => {
    render(<TextareaField label="Notes" value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA')
  })
})

describe('DateField', () => {
  it('renders as type="date"', () => {
    render(<DateField label="Start date" value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Start date')).toHaveAttribute('type', 'date')
  })
})

describe('SearchField', () => {
  it('has a real accessible name even when visually hidden', () => {
    render(<SearchField label="Search bookings" hideLabel value="" onChange={() => {}} />)
    const input = screen.getByLabelText('Search bookings')
    expect(input).toHaveAttribute('type', 'search')
  })
})
