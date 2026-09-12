import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders children and defaults to type="button"', () => {
    render(<Button>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('fires onClick when enabled', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Confirm</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled and does not fire onClick when `disabled` is set', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Delete
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('disables itself and shows aria-busy while `loading`', () => {
    render(<Button loading>Submitting</Button>)
    const btn = screen.getByRole('button', { name: /submitting/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })

  it('applies a distinct class per variant so variants are visually distinguishable', () => {
    const { rerender } = render(<Button variant="primary">X</Button>)
    const primaryClass = screen.getByRole('button', { name: 'X' }).className
    rerender(<Button variant="danger">X</Button>)
    const dangerClass = screen.getByRole('button', { name: 'X' }).className
    expect(primaryClass).not.toBe(dangerClass)
  })
})
