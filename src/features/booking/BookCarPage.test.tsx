import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { BookCarPage } from '@/features/booking/BookCarPage'

function SearchMarker() {
  const location = useLocation()
  return (
    <p>
      SEARCH RESULTS PAGE: {location.pathname}
      {location.search}
    </p>
  )
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/book" element={<BookCarPage />} />
        <Route path="/search" element={<SearchMarker />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BookCarPage', () => {
  it('redirects a bare /book straight to Fleet with the search dialog open', () => {
    renderAt('/book')
    expect(screen.getByText(/SEARCH RESULTS PAGE:/)).toHaveTextContent('/search?mode=book')
  })

  it('forwards any search criteria already on the URL, instead of dropping them', () => {
    renderAt('/book?start=2099-01-10&end=2099-01-12&pickup=loc-a&dropoff=loc-b')
    expect(screen.getByText(/SEARCH RESULTS PAGE:/)).toHaveTextContent(
      '/search?start=2099-01-10&end=2099-01-12&pickup=loc-a&dropoff=loc-b',
    )
  })
})
