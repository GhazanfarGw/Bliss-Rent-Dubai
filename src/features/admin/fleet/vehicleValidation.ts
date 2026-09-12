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

  return errors
}
