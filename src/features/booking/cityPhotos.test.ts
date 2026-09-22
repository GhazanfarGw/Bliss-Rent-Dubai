import { describe, it, expect } from 'vitest'
import { CITY_PHOTOS } from '@/features/booking/cityPhotos'

describe('CITY_PHOTOS', () => {
  it('has a photo for every emirate city the coverage map can pin', () => {
    expect(Object.keys(CITY_PHOTOS).sort()).toEqual(
      ['Abu Dhabi', 'Ajman', 'Al Ain', 'Dubai', 'Fujairah', 'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain'].sort(),
    )
  })

  it('never ships a photo without its license credit (CC BY / CC BY-SA require it)', () => {
    for (const [city, photo] of Object.entries(CITY_PHOTOS)) {
      expect(photo.src, city).toBeTruthy()
      expect(photo.author.trim(), city).not.toBe('')
      expect(photo.license, city).toMatch(/^CC BY(-SA)? \d\.\d$/)
      expect(photo.sourceUrl, city).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
    }
  })
})
