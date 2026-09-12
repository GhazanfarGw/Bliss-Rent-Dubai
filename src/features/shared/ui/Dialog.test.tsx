import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Dialog } from './Dialog'

function renderDialog(onClose = vi.fn()) {
  render(
    <Dialog open onClose={onClose} title="Extend rental" closeLabel="Close">
      <button type="button">First action</button>
      <button type="button">Second action</button>
    </Dialog>,
  )
  return onClose
}

function ToggleHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Panel" closeLabel="Close">
        <p>Body</p>
      </Dialog>
    </>
  )
}

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(
      <Dialog open={false} onClose={() => {}} title="Hidden" closeLabel="Close">
        <p>content</p>
      </Dialog>,
    )
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('exposes role=dialog, aria-modal, and an accessible title', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Extend rental' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('closes on Escape', () => {
    const onClose = renderDialog()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="Panel" closeLabel="Close">
        <p>Body</p>
      </Dialog>,
    )
    // The backdrop is the aria-hidden sibling of the dialog panel.
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('moves focus inside the dialog on open and traps Tab within it', () => {
    renderDialog()
    const second = screen.getByRole('button', { name: 'Second action' })
    const closeBtn = screen.getByRole('button', { name: 'Close' })

    // Close button is the first focusable element in DOM order.
    expect(document.activeElement).toBe(closeBtn)

    second.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    // Tab from the last focusable element wraps back to the first.
    expect(document.activeElement).toBe(closeBtn)

    closeBtn.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    // Shift+Tab from the first focusable element wraps to the last.
    expect(document.activeElement).toBe(second)
  })

  it('restores focus to the element that opened it, once it closes', () => {
    render(<ToggleHarness />)
    const opener = screen.getByRole('button', { name: 'Open dialog' })
    opener.focus()
    expect(document.activeElement).toBe(opener)

    fireEvent.click(opener)
    expect(document.activeElement).not.toBe(opener) // focus moved into the dialog

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(opener)
  })
})
