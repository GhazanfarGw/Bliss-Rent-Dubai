import { describe, it, expect } from 'vitest'
import { validateVehicleDraft } from './vehicleValidation'
import { EMPTY_VEHICLE_DRAFT } from '@/types/domain'

describe('validateVehicleDraft', () => {
  it('accepts a fully filled-in draft', () => {
    const draft = { ...EMPTY_VEHICLE_DRAFT, categoryId: 'cat-1', make: 'Toyota', model: 'Camry', plateNumber: 'A12345' }
    expect(validateVehicleDraft(draft)).toEqual({})
  })

  it('requires a category', () => {
    const draft = { ...EMPTY_VEHICLE_DRAFT, make: 'Toyota', model: 'Camry', plateNumber: 'A12345' }
    expect(validateVehicleDraft(draft).categoryId).toBeTruthy()
  })

  it('requires make and model', () => {
    const draft = { ...EMPTY_VEHICLE_DRAFT, categoryId: 'cat-1', make: '', model: '', plateNumber: 'A12345' }
    const errors = validateVehicleDraft(draft)
    expect(errors.make).toBeTruthy()
    expect(errors.model).toBeTruthy()
  })

  it('rejects an out-of-range model year', () => {
    const draft = { ...EMPTY_VEHICLE_DRAFT, categoryId: 'cat-1', make: 'Toyota', model: 'Camry', plateNumber: 'A12345', modelYear: '1899' }
    expect(validateVehicleDraft(draft).modelYear).toBeTruthy()
  })

  it('rejects an out-of-range seat count', () => {
    const draft = { ...EMPTY_VEHICLE_DRAFT, categoryId: 'cat-1', make: 'Toyota', model: 'Camry', plateNumber: 'A12345', seats: '20' }
    expect(validateVehicleDraft(draft).seats).toBeTruthy()
  })

  it('requires a plate number of at least 2 characters', () => {
    const draft = { ...EMPTY_VEHICLE_DRAFT, categoryId: 'cat-1', make: 'Toyota', model: 'Camry', plateNumber: 'A' }
    expect(validateVehicleDraft(draft).plateNumber).toBeTruthy()
  })

  it('accepts blank optional specifications ("not entered")', () => {
    const draft = { ...EMPTY_VEHICLE_DRAFT, categoryId: 'cat-1', make: 'Toyota', model: 'Camry', plateNumber: 'A12345' }
    expect(validateVehicleDraft(draft)).toEqual({})
  })

  it('accepts sensible optional specifications', () => {
    const draft = {
      ...EMPTY_VEHICLE_DRAFT,
      categoryId: 'cat-1',
      make: 'Toyota',
      model: 'Camry',
      plateNumber: 'A12345',
      horsepower: '203',
      torqueNm: '250',
      topSpeedKmh: '210',
      acceleration0100: '7.9',
      fuelConsumptionL100km: '6.8',
      doors: '4',
    }
    expect(validateVehicleDraft(draft)).toEqual({})
  })

  it.each([
    ['horsepower', '0'],
    ['horsepower', '12.5'],
    ['horsepower', 'abc'],
    ['torqueNm', '99999'],
    ['topSpeedKmh', '900'],
    ['acceleration0100', '0'],
    ['fuelConsumptionL100km', '100'],
    ['doors', '9'],
  ] as const)('rejects an out-of-range or non-numeric %s of "%s"', (field, value) => {
    const draft = { ...EMPTY_VEHICLE_DRAFT, categoryId: 'cat-1', make: 'Toyota', model: 'Camry', plateNumber: 'A12345', [field]: value }
    expect(validateVehicleDraft(draft)[field]).toBeTruthy()
  })
})
