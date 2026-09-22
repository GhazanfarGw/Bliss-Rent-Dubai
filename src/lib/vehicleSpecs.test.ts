import { describe, expect, it } from 'vitest'
import i18n from 'i18next'
import { aboutText, engineLabel, fuelEconomyLabel, highlightItems, keyFigures, kmPerLitre, metaSpecSummary, specRows, type SpecSource } from '@/lib/vehicleSpecs'

const en = i18n.getFixedT('en')
const ar = i18n.getFixedT('ar')

/** A car with only the columns every vehicle has — no specification entered. */
const bare: SpecSource = {
  make: 'Toyota',
  model: 'Corolla',
  model_year: 2023,
  transmission: 'automatic',
  seats: 5,
  engine: null,
  horsepower: null,
  torque_nm: null,
  top_speed_kmh: null,
  acceleration_0_100: null,
  fuel_type: null,
  fuel_consumption_l100km: null,
  drivetrain: null,
  doors: null,
  origin_country: null,
  about: null,
  about_ar: null,
  vehicle_categories: { name: 'Economy' },
}

const full: SpecSource = {
  ...bare,
  make: 'McLaren',
  model: '720S',
  engine: '4.0L twin-turbo V8',
  horsepower: 720,
  torque_nm: 770,
  top_speed_kmh: 341,
  acceleration_0_100: 2.9,
  fuel_type: 'Petrol',
  fuel_consumption_l100km: 12.5,
  drivetrain: 'RWD',
  doors: 2,
  origin_country: 'United Kingdom',
  about: 'A supercar.',
  vehicle_categories: { name: 'Sports & Supercars' },
}

describe('vehicleSpecs — nothing is invented', () => {
  it('gives a car with no specifications no engine, no figures and no about text', () => {
    expect(engineLabel(bare)).toBeNull()
    expect(keyFigures(en, bare)).toEqual([])
    expect(aboutText(bare, 'en')).toBeNull()
    expect(metaSpecSummary(bare)).toBe('')
  })

  it('lists only the basics in the table for such a car — no "N/A" rows for what is missing', () => {
    const keys = specRows(en, bare).map((row) => row.key)
    expect(keys).toEqual(['make', 'model', 'year', 'category', 'transmission', 'seats'])
  })

  it('treats blank or whitespace-only text as not entered', () => {
    expect(engineLabel({ engine: '   ' })).toBeNull()
    expect(aboutText({ about: '  ', about_ar: '' }, 'en')).toBeNull()
  })

  it('keeps a real zero-free value but skips a missing one (only the filled key figures show)', () => {
    const items = keyFigures(en, { ...bare, horsepower: 188, torque_nm: null, top_speed_kmh: 250 })
    expect(items.map((item) => item.key)).toEqual(['power', 'topSpeed'])
  })
})

describe('vehicleSpecs — formatting', () => {
  it('formats the key figures with units, in a fixed order', () => {
    expect(keyFigures(en, full).map((item) => [item.key, item.value])).toEqual([
      ['power', '720 hp'],
      ['torque', '770 Nm'],
      ['acceleration', '2.9 s'],
      ['topSpeed', '341 km/h'],
    ])
  })

  it('separates thousands with Latin digits', () => {
    expect(keyFigures(en, { ...bare, torque_nm: 1000 })[0].value).toBe('1,000 Nm')
    expect(keyFigures(ar, { ...bare, torque_nm: 1000 })[0].value).toBe('1,000 نيوتن·م')
  })

  it('converts litres per 100 km into km per litre, and shows both', () => {
    expect(kmPerLitre(10)).toBe(10)
    expect(kmPerLitre(12.5)).toBe(8)
    expect(kmPerLitre(11.6)).toBe(8.6)
    expect(fuelEconomyLabel(en, 12.5)).toBe('8 km/L · 12.5 L/100 km')
  })

  it('builds the full table in order, translating drivetrain, fuel and country', () => {
    const rows = specRows(en, full)
    expect(rows.map((row) => row.key)).toEqual([
      'make', 'model', 'year', 'category', 'engine', 'power', 'torque', 'acceleration', 'topSpeed',
      'fuelType', 'fuelEconomy', 'drivetrain', 'transmission', 'doors', 'seats', 'origin',
    ])
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    expect(byKey.drivetrain).toBe('Rear-wheel drive (RWD)')
    expect(byKey.fuelType).toBe('Petrol')
    expect(byKey.fuelEconomy).toBe('8 km/L · 12.5 L/100 km')
    expect(byKey.origin).toBe('United Kingdom')
    expect(byKey.transmission).toBe('Automatic')
  })

  it('translates them in Arabic, and keeps a value that has no translation as stored', () => {
    const byKey = Object.fromEntries(specRows(ar, full).map((row) => [row.key, row.value]))
    expect(byKey.drivetrain).toBe('دفع خلفي (RWD)')
    expect(byKey.origin).toBe('المملكة المتحدة')
    const unusual = Object.fromEntries(specRows(en, { ...full, origin_country: 'Sweden', fuel_type: 'Biogas', drivetrain: 'RWD+' }).map((row) => [row.key, row.value]))
    expect(unusual.origin).toBe('Sweden')
    expect(unusual.fuelType).toBe('Biogas')
    expect(unusual.drivetrain).toBe('RWD+')
  })

  it('summarises engine and power for the meta description', () => {
    expect(metaSpecSummary(full)).toBe('4.0L twin-turbo V8, 720 hp')
    expect(metaSpecSummary({ engine: '2.5L 4-cylinder', horsepower: null })).toBe('2.5L 4-cylinder')
    expect(metaSpecSummary({ engine: null, horsepower: 188 })).toBe('188 hp')
  })
})

describe('vehicleSpecs — booking-box highlights', () => {
  it('leads with the performance figures and caps the list at four', () => {
    const items = highlightItems(en, { ...full, doors: 2 })
    expect(items.map((item) => item.key)).toEqual(['power', 'torque', 'acceleration', 'topSpeed'])
  })

  it('tops up with fuel, drive layout, doors and origin when there are fewer performance figures', () => {
    const items = highlightItems(en, { ...bare, horsepower: 188, fuel_type: 'Petrol', drivetrain: 'FWD', doors: 4, origin_country: 'Japan' })
    expect(items.map((item) => [item.key, item.value])).toEqual([
      ['power', '188 hp'],
      ['fuelType', 'Petrol'],
      ['drivetrain', 'FWD'],
      ['doors', '4'],
    ])
  })

  it('is empty for a car with nothing entered, and translates fuel and country in Arabic', () => {
    expect(highlightItems(en, bare)).toEqual([])
    const arabic = highlightItems(ar, { ...bare, fuel_type: 'Petrol', origin_country: 'Germany' })
    expect(arabic.map((item) => item.value)).toEqual(['بنزين', 'ألمانيا'])
  })
})

describe('vehicleSpecs — about text language', () => {
  const both = { about: 'English story', about_ar: 'قصة عربية' }

  it('uses the Arabic text on Arabic pages when there is one', () => {
    expect(aboutText(both, 'ar')).toBe('قصة عربية')
  })

  it('falls back to the English text on Arabic pages with no Arabic entered', () => {
    expect(aboutText({ about: 'English story', about_ar: null }, 'ar')).toBe('English story')
  })

  it('uses the English text everywhere else', () => {
    expect(aboutText(both, 'en')).toBe('English story')
  })
})
