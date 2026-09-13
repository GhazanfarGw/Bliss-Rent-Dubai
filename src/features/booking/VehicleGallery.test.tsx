import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VehicleGallery } from '@/features/booking/VehicleGallery'
import type { Database } from '@/types/database'

type ImageRow = Database['public']['Tables']['vehicle_images']['Row']

function image(overrides: Partial<ImageRow> & { id: string; storage_path: string }): ImageRow {
  return {
    vehicle_id: 'veh-1',
    is_primary: false,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as ImageRow
}

describe('VehicleGallery', () => {
  it('renders a placeholder and disables the lightbox trigger when there are no photos', () => {
    render(<VehicleGallery images={[]} alt="Toyota Camry" />)
    expect(screen.getByLabelText(/view full-screen photo/i)).toBeDisabled()
  })

  it('shows no photo counter or thumbnail strip for a single photo', () => {
    render(<VehicleGallery images={[image({ id: 'img1', storage_path: 'fleet/1.webp', is_primary: true })]} alt="Toyota Camry" />)
    expect(screen.queryByText(/1 \/ 1/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/view photo 1/i)).not.toBeInTheDocument()
  })

  it('switches the active photo when a thumbnail is clicked, and marks it current', async () => {
    render(
      <VehicleGallery
        images={[
          image({ id: 'img1', storage_path: 'fleet/1.webp', is_primary: true, sort_order: 0 }),
          image({ id: 'img2', storage_path: 'fleet/2.webp', sort_order: 1 }),
        ]}
        alt="Toyota Camry"
      />,
    )

    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    const secondThumb = screen.getByLabelText('View photo 2')
    await userEvent.click(secondThumb)

    expect(secondThumb).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('opens a lightbox with prev/next navigation when the main photo is clicked', async () => {
    render(
      <VehicleGallery
        images={[
          image({ id: 'img1', storage_path: 'fleet/1.webp', is_primary: true, sort_order: 0 }),
          image({ id: 'img2', storage_path: 'fleet/2.webp', sort_order: 1 }),
        ]}
        alt="Toyota Camry"
      />,
    )

    await userEvent.click(screen.getByLabelText(/view full-screen photo/i))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText(/next photo/i))
    // The lightbox's own counter (there are now two "2 / 2" texts on
    // screen — the small overlay badge and the lightbox's own — so just
    // assert at least one shows the updated index).
    expect(screen.getAllByText('2 / 2').length).toBeGreaterThan(0)

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
