/**
 * Pure, UX-only validation for the admin Add/Edit Vehicle form — mirrors
 * the schema's own constraints (not-null columns, model_year/seats as
 * sensible positive integers) but the database's own not-null/check
 * constraints remain the authoritative guard, same pattern as
 * src/features/booking/checkout/validation.ts.
 */
import type { VehicleDraft } from '@/types/domain'

export type VehicleFieldErrors = Partial<Record<keyof VehicleDraft, string>>

const CURRENT_YEAR = new Date().getFullYear()

export function validateVehicleDraft(draft: VehicleDraft): VehicleFieldErrors {
  const errors: VehicleFieldErrors = {}

  if (!draft.categoryId) errors.categoryId = 'Please choose a category.'
  if (draft.make.trim().length < 1) errors.make = 'Please enter the make.'
  if (draft.model.trim().length < 1) errors.model = 'Please enter the model.'

  const year = Number(draft.modelYear)
  if (!Number.isInteger(year) || year < 1990 || year > CURRENT_YEAR + 1) {
    errors.modelYear = `Please enter a year between 1990 and ${CURRENT_YEAR + 1}.`
  }

  const seats = Number(draft.seats)
  if (!Number.isInteger(seats) || seats < 1 || seats > 12) {
    errors.seats = 'Please enter a seat count between 1 and 12.'
  }

  if (draft.plateNumber.trim().length < 2) errors.plateNumber = 'Please enter a valid plate number.'

  // Optional specifications: blank is fine ("not entered"), but anything typed
  // must be a sensible number — the same ranges the database checks enforce.
  const optionalNumber = (field: keyof VehicleDraft, min: number, max: number, integer: boolean, message: string) => {
    const raw = draft[field]
    if (typeof raw !== 'string' || raw.trim() === '') return
    const value = Number(raw)
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) errors[field] = message
  }
  optionalNumber('horsepower', 1, 3000, true, 'Power must be a whole number between 1 and 3000 hp.')
  optionalNumber('torqueNm', 1, 5000, true, 'Torque must be a whole number between 1 and 5000 Nm.')
  optionalNumber('topSpeedKmh', 1, 500, true, 'Top speed must be a whole number between 1 and 500 km/h.')
  optionalNumber('acceleration0100', 1, 60, false, '0–100 time must be between 1 and 60 seconds.')
  optionalNumber('fuelConsumptionL100km', 1, 60, false, 'Fuel consumption must be between 1 and 60 L/100 km.')
  optionalNumber('doors', 1, 6, true, 'Doors must be a whole number between 1 and 6.')

  return errors
}
