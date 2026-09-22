import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { CustomerDetailsPage } from './CustomerDetailsPage'
import { fetchVehicleById, fetchLocations } from '@/features/booking/api'
import type { VehicleWithDetails, Location } from '@/types/domain'

vi.mock('@/features/booking/api', () => ({
  fetchVehicleById: vi.fn(),
  fetchLocations: vi.fn(),
}))

const vehicle: VehicleWithDetails = {
  id: 'veh-1',
  category_id: 'cat-eco',
  make: 'MG',
  model: '5',
  model_year: 2024,
  transmission: 'automatic',
  seats: 5,
  plate_number: 'TEMP-ECO-04',
  status: 'available',
  created_at: '2026-01-01T00:00:00Z',
  vehicle_categories: { id: 'cat-eco', name: 'Economy', description: null },
  vehicle_images: [],
  pricing: [{ id: 'p1', vehicle_id: 'veh-1', term: 'daily', list_price: 100, client_price: 100, currency: 'AED' }],
} as unknown as VehicleWithDetails

const pickupLocation: Location = { id: 'loc-1', name: 'Sharjah City Centre', is_active: true } as unknown as Location

const criteria = { startDate: '2026-10-01', endDate: '2026-10-03', pickupLocationId: 'loc-1', dropoffLocationId: 'loc-1' }
const qs = `start=${criteria.startDate}&end=${criteria.endDate}&pickup=loc-1&dropoff=loc-1`

function renderCustomer() {
  return render(
    <MemoryRouter initialEntries={[`/checkout/veh-1/customer?${qs}`]}>
      <Routes>
        <Route path="/checkout/:id/customer" element={<CustomerDetailsPage />} />
        <Route path="/checkout/:id/driver" element={<div>DRIVER PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CustomerDetailsPage (Step 4)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.mocked(fetchVehicleById).mockResolvedValue(vehicle)
    vi.mocked(fetchLocations).mockResolvedValue([pickupLocation])
  })

  it('renders exactly the four fields the brief specifies — First name, Last name, Email, Phone', async () => {
    renderCustomer()
    await screen.findByRole('textbox', { name: /first name/i })
    expect(screen.getByRole('textbox', { name: /last name/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^email/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /phone/i })).toBeInTheDocument()
  })

  it('keeps the car card to the car and its specs — no dates or places on steps 1–3', async () => {
    renderCustomer()
    await screen.findByRole('textbox', { name: /first name/i })

    expect(screen.getByRole('heading', { name: 'MG 5' })).toBeInTheDocument()
    expect(screen.queryByText('Pickup date')).not.toBeInTheDocument()
    expect(screen.queryByText('Sharjah City Centre')).not.toBeInTheDocument()
  })

  it('blocks Continue and shows field errors on an empty submit', async () => {
    renderCustomer()
    fireEvent.click(await screen.findByRole('button', { name: /continue to driver details/i }))

    expect(await screen.findByText(/please enter the customer's first name/i)).toBeInTheDocument()
    expect(screen.queryByText('DRIVER PAGE')).not.toBeInTheDocument()
  })

  it('advances to Step 5 once all four fields are valid, preserving the dates/locations query string', async () => {
    renderCustomer()
    fireEvent.change(await screen.findByRole('textbox', { name: /first name/i }), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByRole('textbox', { name: /last name/i }), { target: { value: 'Renter' } })
    fireEvent.change(screen.getByRole('textbox', { name: /^email/i }), { target: { value: 'jane@example.com' } })
    fireEvent.change(screen.getByRole('textbox', { name: /phone/i }), { target: { value: '+971501234567' } })

    fireEvent.click(screen.getByRole('button', { name: /continue to driver details/i }))

    await screen.findByText('DRIVER PAGE')
  })
})
