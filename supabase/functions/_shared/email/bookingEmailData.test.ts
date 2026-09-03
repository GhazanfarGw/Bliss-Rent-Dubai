import { describe, it, expect } from 'vitest'
import { fetchBookingEmailRow, buildBookingSummaryFromRow, BookingEmailDataError, type BookingEmailRow } from './bookingEmailData.ts'

const row: BookingEmailRow = {
  id: 'd300ac89-03b4-4f51-93b9-49b7c3f235d7',
  status: 'confirmed',
  start_date: '2026-09-10',
  end_date: '2026-09-15',
  total_price: 750,
  currency: 'AED',
  customers: { full_name: 'Jane Renter', email: 'jane@example.com' },
  vehicles: { make: 'Toyota', model: 'Camry' },
  pickup_location: { name: 'DXB Terminal 3' },
  dropoff_location: { name: 'DXB Terminal 3' },
}

function fakeSupabase(result: { data: BookingEmailRow | null; error: { message: string } | null }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => result,
        }),
      }),
    }),
  }
}

describe('fetchBookingEmailRow', () => {
  it('returns the row on success', async () => {
    const result = await fetchBookingEmailRow(fakeSupabase({ data: row, error: null }), row.id)
    expect(result).toEqual(row)
  })

  it('throws BookingEmailDataError on a database error', async () => {
    await expect(fetchBookingEmailRow(fakeSupabase({ data: null, error: { message: 'connection reset' } }), row.id)).rejects.toThrow(
      BookingEmailDataError,
    )
  })

  it('throws BookingEmailDataError when no booking is found', async () => {
    await expect(fetchBookingEmailRow(fakeSupabase({ data: null, error: null }), 'missing-id')).rejects.toThrow(
      /no booking found/,
    )
  })
})

describe('buildBookingSummaryFromRow', () => {
  it('formats the reference using the same BLS- formula as the rest of the app', () => {
    const summary = buildBookingSummaryFromRow(row)
    expect(summary.reference).toBe('BLS-D300AC89')
  })

  it('formats the vehicle name as "make model", matching ConfirmationPage/ManageBookingPage', () => {
    expect(buildBookingSummaryFromRow(row).vehicleName).toBe('Toyota Camry')
  })

  it('formats dates as "start → end", matching ConfirmationPage/ManageBookingPage', () => {
    expect(buildBookingSummaryFromRow(row).rentalDatesLabel).toBe('2026-09-10 → 2026-09-15')
  })

  it('formats amount as "currency total.toLocaleString()", matching ConfirmationPage/ManageBookingPage', () => {
    expect(buildBookingSummaryFromRow(row).amountLabel).toBe('AED 750')
  })

  it('falls back to a placeholder vehicle name when the join returned null', () => {
    expect(buildBookingSummaryFromRow({ ...row, vehicles: null }).vehicleName).toBe('Vehicle')
  })

  it('includes optional payment/booking status labels only when passed', () => {
    const withStatus = buildBookingSummaryFromRow(row, { paymentStatusLabel: 'Paid', bookingStatusLabel: 'Confirmed' })
    expect(withStatus.paymentStatusLabel).toBe('Paid')
    expect(withStatus.bookingStatusLabel).toBe('Confirmed')
    expect(buildBookingSummaryFromRow(row).paymentStatusLabel).toBeUndefined()
  })
})
