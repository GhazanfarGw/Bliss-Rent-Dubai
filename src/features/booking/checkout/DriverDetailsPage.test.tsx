import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { DriverDetailsPage } from './DriverDetailsPage'
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

function seedCustomerDraft(customer: { firstName: string; lastName: string; phone: string; email?: string }) {
  sessionStorage.setItem(
    'dxb-checkout:veh-1',
    JSON.stringify({
      vehicleId: 'veh-1',
      criteria,
      customer: { email: 'jane@example.com', ...customer },
      driver: { isSameAsCustomer: true, firstName: '', lastName: '', phone: '', licenseNumber: '', licenseCountry: '', licenseExpiry: '' },
    }),
  )
}

function renderDriver() {
  return render(
    <MemoryRouter initialEntries={[`/checkout/veh-1/driver?${qs}`]}>
      <Routes>
        <Route path="/checkout/:id/driver" element={<DriverDetailsPage />} />
        <Route path="/checkout/:id/summary" element={<div>SUMMARY PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DriverDetailsPage (Step 5)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.mocked(fetchVehicleById).mockResolvedValue(vehicle)
    vi.mocked(fetchLocations).mockResolvedValue([pickupLocation])
  })

  it('defaults to "I am the driver" and shows the customer\'s own name/phone from Step 4 read-only, without asking to retype it', async () => {
    seedCustomerDraft({ firstName: 'Jane', lastName: 'Renter', phone: '+971501234567' })
    renderDriver()

    expect(await screen.findByText(/Jane Renter/)).toBeInTheDocument()
    expect(screen.getByText(/\+971501234567/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /driver's first name/i })).not.toBeInTheDocument()
  })

  it('switching to "Someone else will drive" reveals First/Last/Phone fields for that person', async () => {
    seedCustomerDraft({ firstName: 'Jane', lastName: 'Renter', phone: '+971501234567' })
    renderDriver()

    fireEvent.click(await screen.findByRole('button', { name: /someone else will drive/i }))

    expect(screen.getByRole('textbox', { name: /driver's first name/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /driver's last name/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /driver phone number/i })).toBeInTheDocument()
  })

  it('blocks Continue until the license fields are filled in, even in "I am the driver" mode', async () => {
    seedCustomerDraft({ firstName: 'Jane', lastName: 'Renter', phone: '+971501234567' })
    renderDriver()

    fireEvent.click(await screen.findByRole('button', { name: /continue to booking summary/i }))

    expect(await screen.findByText(/please enter a valid driving license number/i)).toBeInTheDocument()
    expect(screen.queryByText('SUMMARY PAGE')).not.toBeInTheDocument()
  })

  it('advances to Step 6 once the license fields are valid', async () => {
    seedCustomerDraft({ firstName: 'Jane', lastName: 'Renter', phone: '+971501234567' })
    renderDriver()

    fireEvent.change(await screen.findByRole('textbox', { name: /license number/i }), { target: { value: 'DL123456' } })
    fireEvent.change(screen.getByRole('textbox', { name: /issuing country/i }), { target: { value: 'United Arab Emirates' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2030-01-01' } })

    fireEvent.click(screen.getByRole('button', { name: /continue to booking summary/i }))

    await screen.findByText('SUMMARY PAGE')
  })

  it('requires First/Last/Phone for "someone else" before allowing Continue', async () => {
    seedCustomerDraft({ firstName: 'Jane', lastName: 'Renter', phone: '+971501234567' })
    renderDriver()

    fireEvent.click(await screen.findByRole('button', { name: /someone else will drive/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /license number/i }), { target: { value: 'DL123456' } })
    fireEvent.change(screen.getByRole('textbox', { name: /issuing country/i }), { target: { value: 'UAE' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2030-01-01' } })

    fireEvent.click(screen.getByRole('button', { name: /continue to booking summary/i }))

    expect(await screen.findByText(/please enter the driver's first name/i)).toBeInTheDocument()
    expect(screen.queryByText('SUMMARY PAGE')).not.toBeInTheDocument()
  })
})
