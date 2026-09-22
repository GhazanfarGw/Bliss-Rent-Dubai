import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CheckoutStepLayout } from '@/features/booking/checkout/CheckoutStepLayout'
import { CheckoutActions, revealFirstError } from '@/features/booking/checkout/CheckoutActions'
import type { VehicleWithDetails, Location } from '@/types/domain'

const vehicle = {
  id: 'veh-1',
  make: 'MG',
  model: '5',
  model_year: 2024,
  transmission: 'automatic',
  vehicle_images: [],
  pricing: [{ id: 'p1', vehicle_id: 'veh-1', term: 'daily', list_price: 100, client_price: 100, currency: 'AED' }],
} as unknown as VehicleWithDetails

const place = { id: 'loc-1', name: 'Sharjah City Centre' } as unknown as Location

function renderLayout(children: React.ReactNode, props: Partial<React.ComponentProps<typeof CheckoutStepLayout>> = {}) {
  return render(
    <MemoryRouter>
      <CheckoutStepLayout
        stepIndex={2}
        title="Review your booking"
        vehicle={vehicle}
        startDate="2026-10-01"
        endDate="2026-10-03"
        pickup={place}
        dropoff={place}
        {...props}
      >
        {children}
      </CheckoutStepLayout>
    </MemoryRouter>,
  )
}

/** The bar: the closest ancestor of the buttons that is `fixed` to the screen. */
function actionBar(el: HTMLElement): HTMLElement | null {
  return el.closest('.fixed')
}

describe('CheckoutStepLayout — the fixed action bar', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--checkout-bar-h')
  })

  it("draws a step's buttons in a bar fixed to the bottom of the screen", async () => {
    renderLayout(
      <CheckoutActions backTo="/checkout/veh-1/driver">
        <button type="button">Confirm it</button>
      </CheckoutActions>,
    )

    const confirm = await screen.findByRole('button', { name: 'Confirm it' })
    const back = screen.getByRole('link', { name: 'Back' })
    expect(back).toHaveAttribute('href', '/checkout/veh-1/driver')
    const bar = actionBar(confirm)
    expect(bar).not.toBeNull()
    expect(bar).toContainElement(back)
    expect(bar?.className).toContain('bottom-0')
    expect(bar?.className).not.toContain('sticky') // it must never scroll away with the page
  })

  it("shows the car's specifications in the trip card — only the ones that are filled in", async () => {
    const sportsCar = {
      ...vehicle,
      fuel_type: 'Petrol',
      drivetrain: 'rwd',
      doors: 2,
      origin_country: 'Germany',
      engine: '3.0L twin-turbo flat-six',
    } as unknown as VehicleWithDetails
    renderLayout(<CheckoutActions />, { vehicle: sportsCar })

    expect(await screen.findByText('Fuel type')).toBeInTheDocument()
    expect(screen.getByText('Petrol')).toBeInTheDocument()
    expect(screen.getByText('RWD')).toBeInTheDocument()
    expect(screen.getByText('Doors')).toBeInTheDocument()
    expect(screen.getByText('Germany')).toBeInTheDocument()
    expect(screen.getByText('3.0L twin-turbo flat-six')).toBeInTheDocument()
  })

  it('shows no specification tiles for a car with none entered — nothing is invented', async () => {
    renderLayout(<CheckoutActions />)

    await screen.findAllByText('Estimated total')
    expect(screen.queryByText('Fuel type')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /key figures/i })).not.toBeInTheDocument()
  })

  it('shows the estimated total and days in the bar, and again in the trip card', async () => {
    renderLayout(<CheckoutActions />)

    // 1–3 October counts as 3 days, at AED 100 a day — the bar's copy and the trip card's own copy.
    // "AED" is now the Dirham glyph (an inline SVG, not text), so only the number is plain text.
    await screen.findAllByText('Estimated total')
    expect(screen.getAllByText(/300/)).toHaveLength(2)
    expect(screen.getByText(/100 per day × 3/)).toBeInTheDocument()
  })

  it('the fixed bar stays on screen always — no hide-on-scroll behavior', async () => {
    renderLayout(<CheckoutActions />)
    const labels = await screen.findAllByText('Estimated total')
    const bar = labels.map(actionBar).find((b) => b !== null) ?? null
    expect(bar).not.toHaveAttribute('aria-hidden', 'true')
    expect(bar).not.toHaveAttribute('inert')
  })

  it('shows an overriding total (e.g. the exact amount due) instead of the estimate', async () => {
    renderLayout(<CheckoutActions />, { total: { label: 'Amount due', amount: 952, currency: 'AED' } })

    // Shown in both the fixed bar and the trip card.
    expect(await screen.findAllByText(/952/)).toHaveLength(2)
    expect(screen.getAllByText('Amount due')).toHaveLength(2)
    expect(screen.queryByText('Estimated total')).not.toBeInTheDocument()
    expect(screen.queryByText(/300/)).not.toBeInTheDocument()
  })

  it('lists the dates and places in the trip card by default, and leaves them out when the step lists them itself', async () => {
    const { unmount } = renderLayout(<CheckoutActions />)
    expect(await screen.findByText('Pickup date')).toBeInTheDocument()
    expect(screen.getAllByText('Sharjah City Centre')).toHaveLength(2)
    unmount()

    renderLayout(<CheckoutActions />, { showTripInCard: false })
    await screen.findAllByText('Estimated total')
    expect(screen.queryByText('Pickup date')).not.toBeInTheDocument()
    expect(screen.queryByText('Sharjah City Centre')).not.toBeInTheDocument()
    // the car itself is still there
    expect(screen.getByRole('heading', { name: 'MG 5' })).toBeInTheDocument()
  })

  it('keeps the total in the trip card when there is no price to show in the bar', async () => {
    const unpriced = { ...vehicle, pricing: [] } as unknown as VehicleWithDetails
    renderLayout(<CheckoutActions />, { vehicle: unpriced })

    expect(await screen.findByText('Pricing unavailable')).toBeInTheDocument()
    expect(screen.queryByText('Estimated total')).not.toBeInTheDocument()
  })

  it('uses a custom label for the Back control', async () => {
    renderLayout(<CheckoutActions backTo="/checkout/veh-1/summary" backLabel="Back to summary" />)

    expect(await screen.findByRole('link', { name: 'Back to summary' })).toHaveAttribute('href', '/checkout/veh-1/summary')
  })

  it('a submit button in the bar submits a form that is elsewhere on the page', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    renderLayout(
      <>
        <form id="details-form" onSubmit={onSubmit}>
          <input aria-label="Name" />
        </form>
        <CheckoutActions>
          <button type="submit" form="details-form">
            Continue
          </button>
        </CheckoutActions>
      </>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("publishes the bar's height for the chat button, and takes it away when the page goes", async () => {
    const { unmount } = renderLayout(<CheckoutActions />)
    await screen.findAllByText('Estimated total')

    expect(document.documentElement.style.getPropertyValue('--checkout-bar-h')).toMatch(/^\d+px$/)
    unmount()
    expect(document.documentElement.style.getPropertyValue('--checkout-bar-h')).toBe('')
  })
})

describe('revealFirstError', () => {
  it('focuses and scrolls to the first field marked invalid', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    render(
      <form>
        <input aria-label="fine" />
        <input aria-label="broken" aria-invalid="true" />
        <input aria-label="also broken" aria-invalid="true" />
      </form>,
    )

    revealFirstError()

    await waitFor(() => expect(screen.getByLabelText('broken')).toHaveFocus())
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    // @ts-expect-error — jsdom has no Element.scrollIntoView, so remove the stub again
    delete Element.prototype.scrollIntoView
  })

  it('does nothing when no field is invalid', async () => {
    render(<input aria-label="fine" />)
    expect(() => revealFirstError()).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.getByLabelText('fine')).not.toHaveFocus()
  })
})
