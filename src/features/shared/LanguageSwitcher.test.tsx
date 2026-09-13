import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguageSwitcher } from '@/features/shared/LanguageSwitcher'
import i18n from '@/i18n'

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    // This component reads the shared i18n singleton directly rather
    // than an isolated per-test instance, so pin its language before
    // each test rather than assuming ordering.
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  afterEach(async () => {
    // Reset to the default so other test files aren't affected by a
    // language change this file made.
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('shows the real UAE flag when offering to switch to Arabic (this business\'s real home-market language)', async () => {
    render(<LanguageSwitcher />)
    const button = screen.getByRole('button')
    // The flag SVG carries no lucide-icon class — that's how it's told
    // apart from the globe icon used for the English option.
    expect(button.querySelector('svg:not(.lucide)')).toBeInTheDocument()
    expect(button.querySelector('svg.lucide-globe')).not.toBeInTheDocument()
    expect(button).toHaveTextContent('العربية')
  })

  it('shows a neutral globe icon, never a national flag, when offering to switch to English', async () => {
    await act(async () => {
      await i18n.changeLanguage('ar')
    })
    render(<LanguageSwitcher />)
    const button = screen.getByRole('button')
    expect(button.querySelector('svg:not(.lucide)')).not.toBeInTheDocument()
    expect(button.querySelector('svg.lucide-globe')).toBeInTheDocument()
    expect(button).toHaveTextContent('English')
  })

  it('toggles the language on click', async () => {
    render(<LanguageSwitcher />)
    await userEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(i18n.language).toBe('ar'))
  })
})
