import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PaymentPendingPage } from './PaymentPendingPage'
import { fetchVehicleById, fetchLocations } from '@/features/booking/api'
import { saveBookingResult } from './checkoutStorage'
import type { BookingCreationResult, Location, VehicleWithDetails } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({ fetchVehicleById: vi.fn(), fetchLocations: vi.fn() }))

const vehicle = {
  id: 'veh-1', make: 'MG', model: '5', model_year: 2024, transmission: 'automatic',
  vehicle_images: [],
  pricing: [{ term: 'daily', list_price: 100, client_price: 100, currency: 'AED' }],
} as unknown as VehicleWithDetails
const place = { id: 'loc-1', name: 'Dubai Airport' } as Location
const booking = {
  bookingId: 'bk-1', bookingReference: 'BLS-TEST1234', customerId: 'cust-1', driverId: 'drv-1',
  paymentId: 'pay-1', status: 'pending_payment', term: 'daily', unitPrice: 100,
  totalPrice: 275, currency: 'AED', days: 3,
} as BookingCreationResult
const qs = 'start=2026-10-01&end=2026-10-03&pickup=loc-1&dropoff=loc-1'

function renderPayment() {
  return render(
    <MemoryRouter initialEntries={[`/checkout/veh-1/payment/bk-1?${qs}`]}>
      <Routes>
        <Route path="/checkout/:id/payment/:bookingId" element={<PaymentPendingPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
  vi.mocked(fetchVehicleById).mockResolvedValue(vehicle)
  vi.mocked(fetchLocations).mockResolvedValue([place])
})

describe('PaymentPendingPage', () => {
  it('keeps one WhatsApp action with the saved booking reference and the exact amount due', async () => {
    saveBookingResult(booking)
    renderPayment()

    const whatsapp = await screen.findByRole('link', { name: 'Continue on WhatsApp' })
    expect(screen.getAllByRole('link', { name: 'Continue on WhatsApp' })).toHaveLength(1)
    const actions = screen.getByTestId('checkout-actions')
    expect(actions).toContainElement(whatsapp)
    expect(within(actions).getByText('275')).toBeInTheDocument()
    expect(within(actions).getByRole('link', { name: 'Back to summary' })).toHaveAttribute('href', `/checkout/veh-1/summary?${qs}`)
    const url = new URL(whatsapp.getAttribute('href')!)
    expect(url.hostname).toBe('wa.me')
    expect(url.searchParams.get('text')).toContain('MG 5')
    expect(url.searchParams.get('text')).toContain('BLS-TEST1234')
    expect(whatsapp).toHaveAttribute('target', '_blank')
    expect(screen.queryByText('Estimated total')).not.toBeInTheDocument()
    expect(screen.queryByText('300')).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80')
  })

  it('requires a saved booking before offering the WhatsApp handoff', async () => {
    renderPayment()
    expect(await screen.findByText(/we can't find that booking in this browser/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Continue on WhatsApp' })).not.toBeInTheDocument()
  })
})
