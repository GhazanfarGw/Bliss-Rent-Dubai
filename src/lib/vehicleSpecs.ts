import type { TFunction } from 'i18next'
import { categoryKey, categoryLabel } from '@/lib/categoryName'
import type { Database } from '@/types/database'

/**
 * Turns a vehicle's optional specification columns into things the pages can
 * show: a "key figures" strip, a full specification table, the about text and
 * the card's engine line.
 *
 * The one rule: a field appears only when it is filled in. Nothing here ever
 * substitutes a default, an estimate or a "N/A" — a car with no engine entered
 * simply has no engine row. (The figures themselves are entered by an admin.)
 */
type VehicleRow = Database['public']['Tables']['vehicles']['Row']

export type SpecSource = Pick<
  VehicleRow,
  | 'make'
  | 'model'
  | 'model_year'
  | 'transmission'
  | 'seats'
  | 'engine'
  | 'horsepower'
  | 'torque_nm'
  | 'top_speed_kmh'
  | 'acceleration_0_100'
  | 'fuel_type'
  | 'fuel_consumption_l100km'
  | 'drivetrain'
  | 'doors'
  | 'origin_country'
  | 'about'
  | 'about_ar'
> & { vehicle_categories?: { name: string } | null }

export interface SpecItem {
  key: string
  label: string
  /** Value with its unit, already formatted, e.g. "563 hp". */
  value: string
}

/** Trimmed text, or null when the field is empty / whitespace. */
export function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Numbers are printed with Latin digits in both languages, like the rest of the site. */
const num = (value: number) => value.toLocaleString('en-US')

/** Litres per 100 km → kilometres per litre, one decimal ("11.6" → 8.6). */
export function kmPerLitre(litresPer100Km: number): number {
  return Math.round((100 / litresPer100Km) * 10) / 10
}

/** The engine line shown on the vehicle card, or null when none is recorded. */
export function engineLabel(vehicle: Pick<SpecSource, 'engine'>): string | null {
  return textOrNull(vehicle.engine)
}

/** The "about this car" text in the active language; Arabic falls back to the English text. */
export function aboutText(vehicle: Pick<SpecSource, 'about' | 'about_ar'>, language: string): string | null {
  const arabic = language.startsWith('ar') ? textOrNull(vehicle.about_ar) : null
  return arabic ?? textOrNull(vehicle.about)
}

/** Power, torque, 0–100 and top speed — the headline numbers, only those that are filled. */
export function keyFigures(t: TFunction, vehicle: SpecSource): SpecItem[] {
  const items: SpecItem[] = []
  if (vehicle.horsepower != null) {
    items.push({ key: 'power', label: t('vehicleSpecs.labels.power'), value: `${num(vehicle.horsepower)} ${t('vehicleSpecs.units.hp')}` })
  }
  if (vehicle.torque_nm != null) {
    items.push({ key: 'torque', label: t('vehicleSpecs.labels.torque'), value: `${num(vehicle.torque_nm)} ${t('vehicleSpecs.units.nm')}` })
  }
  if (vehicle.acceleration_0_100 != null) {
    items.push({
      key: 'acceleration',
      label: t('vehicleSpecs.labels.acceleration'),
      value: `${Number(vehicle.acceleration_0_100).toFixed(1)} ${t('vehicleSpecs.units.seconds')}`,
    })
  }
  if (vehicle.top_speed_kmh != null) {
    items.push({ key: 'topSpeed', label: t('vehicleSpecs.labels.topSpeed'), value: `${num(vehicle.top_speed_kmh)} ${t('vehicleSpecs.units.kmh')}` })
  }
  return items
}

/**
 * The handful of facts worth showing at a glance in the booking box: the key
 * figures first, then — for a car that has none of them entered — fuel, drive
 * layout, doors and country of origin, so the box is never empty when there is
 * something real to say. Only filled fields; at most `max` of them.
 */
export function highlightItems(t: TFunction, vehicle: SpecSource, max = 4): SpecItem[] {
  const items = keyFigures(t, vehicle)

  const fuelType = textOrNull(vehicle.fuel_type)
  if (fuelType) items.push({ key: 'fuelType', label: t('vehicleSpecs.labels.fuelType'), value: translated(t, 'fuel', fuelType) })

  const drivetrain = textOrNull(vehicle.drivetrain)
  // The short code (AWD, RWD…) — the long wording is for the full table.
  if (drivetrain) items.push({ key: 'drivetrain', label: t('vehicleSpecs.labels.drivetrain'), value: drivetrain.toUpperCase() })

  if (vehicle.doors != null) items.push({ key: 'doors', label: t('vehicleSpecs.labels.doors'), value: String(vehicle.doors) })

  const origin = textOrNull(vehicle.origin_country)
  if (origin) items.push({ key: 'origin', label: t('vehicleSpecs.labels.origin'), value: translated(t, 'countries', origin) })

  return items.slice(0, max)
}

/** "8.6 km/L · 11.6 L/100 km" — the distance per litre first, since that is how it is usually asked. */
export function fuelEconomyLabel(t: TFunction, litresPer100Km: number): string {
  const l100 = Number(litresPer100Km)
  return `${kmPerLitre(l100)} ${t('vehicleSpecs.units.kmpl')} · ${l100} ${t('vehicleSpecs.units.l100')}`
}

/** Translates a stored value through `vehicleSpecs.<group>.<key>`, keeping the stored text when there is no translation. */
function translated(t: TFunction, group: 'fuel' | 'countries', value: string): string {
  return t(`vehicleSpecs.${group}.${categoryKey(value)}`, { defaultValue: value })
}

/** Every filled specification as label/value rows, in the order the table shows them. */
export function specRows(t: TFunction, vehicle: SpecSource): SpecItem[] {
  const rows: SpecItem[] = [
    { key: 'make', label: t('vehicleSpecs.labels.make'), value: vehicle.make },
    { key: 'model', label: t('vehicleSpecs.labels.model'), value: vehicle.model },
    { key: 'year', label: t('vehicleSpecs.labels.year'), value: String(vehicle.model_year) },
  ]
  if (vehicle.vehicle_categories) {
    rows.push({ key: 'category', label: t('vehicleSpecs.labels.category'), value: categoryLabel(t, vehicle.vehicle_categories.name) })
  }

  const engine = engineLabel(vehicle)
  if (engine) rows.push({ key: 'engine', label: t('vehicleSpecs.labels.engine'), value: engine })
  rows.push(...keyFigures(t, vehicle))

  const fuelType = textOrNull(vehicle.fuel_type)
  if (fuelType) rows.push({ key: 'fuelType', label: t('vehicleSpecs.labels.fuelType'), value: translated(t, 'fuel', fuelType) })
  if (vehicle.fuel_consumption_l100km != null) {
    rows.push({ key: 'fuelEconomy', label: t('vehicleSpecs.labels.fuelEconomy'), value: fuelEconomyLabel(t, vehicle.fuel_consumption_l100km) })
  }

  const drivetrain = textOrNull(vehicle.drivetrain)
  if (drivetrain) {
    rows.push({
      key: 'drivetrain',
      label: t('vehicleSpecs.labels.drivetrain'),
      value: t(`vehicleSpecs.drivetrain.${drivetrain.toUpperCase()}`, { defaultValue: drivetrain }),
    })
  }

  rows.push({
    key: 'transmission',
    label: t('vehicleSpecs.labels.transmission'),
    value: t(`vehicleCard.transmission.${vehicle.transmission}`, { defaultValue: vehicle.transmission }),
  })
  if (vehicle.doors != null) rows.push({ key: 'doors', label: t('vehicleSpecs.labels.doors'), value: String(vehicle.doors) })
  rows.push({ key: 'seats', label: t('vehicleSpecs.labels.seats'), value: String(vehicle.seats) })

  const origin = textOrNull(vehicle.origin_country)
  if (origin) rows.push({ key: 'origin', label: t('vehicleSpecs.labels.origin'), value: translated(t, 'countries', origin) })

  return rows
}

/** Extra clause for a vehicle's meta description, e.g. "4.0L twin-turbo V8, 720 hp" — empty when neither is recorded. */
export function metaSpecSummary(vehicle: Pick<SpecSource, 'engine' | 'horsepower'>): string {
  const parts = [engineLabel(vehicle), vehicle.horsepower != null ? `${num(vehicle.horsepower)} hp` : null].filter(Boolean)
  return parts.join(', ')
}
