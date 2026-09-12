import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider } from './Toast'
import { useToast } from './toastContext'

function Trigger() {
  const { showToast } = useToast()
  return (
    <button type="button" onClick={() => showToast('Saved successfully', { tone: 'success', durationMs: 1000 })}>
      Save
    </button>
  )
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws a clear error when useToast is called outside a ToastProvider', () => {
    function Bare() {
      useToast()
      return null
    }
    expect(() => render(<Bare />)).toThrow(/ToastProvider/)
  })

  it('shows a toast in a role="status" live region, then removes it after its duration', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    const button = screen.getByRole('button', { name: 'Save' })
    await act(async () => button.click())

    const region = screen.getByRole('status')
    expect(region).toHaveTextContent('Saved successfully')

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(region).not.toHaveTextContent('Saved successfully')
  })
})
