import type { TFunction } from 'i18next'

/**
 * `vehicle_categories.name` is a single, English string in the database
 * (e.g. "Sports & Supercars"), managed from the admin dashboard — so the
 * site can't show it translated by just printing it. These two helpers give
 * every category a stable, language-independent key and look its display
 * name up in `vehicleCategories.*` (en.ts / ar.ts). A category that has no
 * translation yet — say one an admin adds tomorrow — falls back to its
 * stored name instead of showing a raw i18n key or nothing.
 */

/** "Sports & Supercars" → "sports_supercars". Also how static per-category copy is matched to a live category. */
export function categoryKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** The category's name in the active language, or its stored name if it has no translation. */
export function categoryLabel(t: TFunction, name: string): string {
  return t(`vehicleCategories.${categoryKey(name)}`, { defaultValue: name })
}
