import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight } from 'lucide-react'
import { Dialog } from '@/features/shared/ui/Dialog'
import { inputClass } from '@/features/shared/ui/inputClasses'
import { TYPE_ICON, typeOrderIndex } from '@/features/booking/locationDisplay'
import type { Location } from '@/types/domain'

/**
 * Two small, independent field primitives that together replace the
 * earlier card-grouped `LocationField` (city + point stacked under one
 * shared header). The single-flat-row search bar needs each field
 * individually labelled and laid out side by side — see SearchWidget.tsx
 * — rather than grouped visually into a "Pickup Location" card, so this
 * file now exports the two pieces directly:
 *
 *  - `CitySelect` — the plain city `<select>`, own label.
 *  - `LocationPickerButton` — the trigger + sheet for a specific point.
 *    Takes its candidate list already filtered by the caller, so it works
 *    equally for a city-scoped Pickup point and for an UAE-wide Return
 *    Location list shown when "Same Return Location" is unchecked (per
 *    the reference layout, the Return field searches every location
 *    directly — it has no city step of its own).
 *
 * Deliberately still no Country level and no separate Location-Type
 * selector: Bliss Rent is UAE-only, and each option row already shows its
 * type as an icon.
 */

interface CitySelectProps {
  label: string
  ariaLabel: string
  value: string
  onChange: (city: string) => void
  cities: string[]
  disabled?: boolean
  /** Compact single-line variant for the flat search-bar row. */
  row?: boolean
  /** Fill the available column in sectioned booking layouts. */
  fluid?: boolean
}

export function CitySelect({ label, ariaLabel, value, onChange, cities, disabled = false, row = false, fluid = false }: CitySelectProps) {
  return (
    <div className={row ? 'flex w-full flex-col gap-1 sm:w-32 sm:shrink-0' : fluid ? 'flex w-full flex-col gap-1' : 'flex w-full flex-col gap-1 sm:w-64'}>
      <span className="block text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={inputClass()}
      >
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  )
}

interface LocationPickerButtonProps {
  label: string
  locationId: string
  onLocationChange: (id: string) => void
  /** Already filtered to whatever this field should offer — city-scoped for Pickup, UAE-wide for Return. */
  options: Location[]
  loading: boolean
  error?: string | null
  placeholder: string
  sheetTitle: string
  /** Compact single-line variant for the flat search-bar row. */
  row?: boolean
  /** Fill the available column in sectioned booking layouts. */
  fluid?: boolean
}

export function LocationPickerButton({
  label,
  locationId,
  onLocationChange,
  options,
  loading,
  error,
  placeholder,
  sheetTitle,
  row = false,
  fluid = false,
}: LocationPickerButtonProps) {
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const disabled = loading || !!error
  const sorted = options
    .slice()
    .sort((a, b) => typeOrderIndex(a.type) - typeOrderIndex(b.type) || a.name.localeCompare(b.name))
  const selected = sorted.find((l) => l.id === locationId) ?? null

  return (
    <div className={row ? 'flex w-full min-w-0 flex-col gap-1 sm:flex-1 sm:min-w-[190px]' : fluid ? 'flex w-full min-w-0 flex-col gap-1' : 'flex w-full flex-col gap-1 sm:w-64'}>
      <span className="block text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        disabled={disabled}
        aria-expanded={sheetOpen}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2.5 text-start text-sm text-brand-navy outline-none transition-colors focus:border-brand-navy focus:ring-1 focus:ring-brand-navy disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
      >
        <span className="min-w-0 truncate font-medium">
          {loading ? t('searchWidget.loadingLocations') : selected ? `${TYPE_ICON[selected.type]} ${selected.name}` : placeholder}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-text-muted rtl:rotate-180" aria-hidden="true" />
      </button>

      <Dialog open={sheetOpen} onClose={() => setSheetOpen(false)} title={sheetTitle} closeLabel={t('common.close')} mobileSheet maxWidthClassName="max-w-xl">
        <LocationOptionList
          options={sorted.map(locationToOption)}
          selectedId={locationId}
          searchable
          searchPlaceholder={t('searchWidget.searchLocations')}
          noMatchesLabel={t('searchWidget.noMatches')}
          onSelect={(id) => {
            onLocationChange(id)
            setSheetOpen(false)
          }}
        />
      </Dialog>
    </div>
  )
}

function locationToOption(loc: Location): SheetOption {
  const sublabel =
    loc.type === 'airport' && loc.airport_code ? `${loc.airport_code} · ${loc.city}` : loc.city
  return { id: loc.id, label: loc.name, icon: TYPE_ICON[loc.type], sublabel }
}

interface SheetOption {
  id: string
  label: string
  sublabel?: string
  icon?: string
}

/** Shared option list for the location-picker sheet — large tap targets, an icon + sub-label per row, a selected-state check mark, and a live search filter. */
function LocationOptionList({
  options,
  selectedId,
  onSelect,
  searchable = false,
  searchPlaceholder,
  noMatchesLabel,
}: {
  options: SheetOption[]
  selectedId: string
  onSelect: (id: string) => void
  searchable?: boolean
  searchPlaceholder?: string
  noMatchesLabel?: string
}) {
  const [query, setQuery] = useState('')
  const filtered =
    searchable && query.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
      : options

  return (
    <div>
      {searchable && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className={inputClass() + ' mb-3'}
        />
      )}
      <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
        {filtered.map((opt) => (
          <li key={opt.id}>
            <button
              type="button"
              onClick={() => onSelect(opt.id)}
              className={
                'flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-gold ' +
                (opt.id === selectedId
                  ? 'bg-brand-lavender/60 text-brand-navy'
                  : 'text-brand-navy hover:bg-surface-muted')
              }
            >
              {opt.icon && (
                <span className="text-lg" aria-hidden="true">
                  {opt.icon}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{opt.label}</span>
                {opt.sublabel && <span className="block truncate text-xs text-text-muted">{opt.sublabel}</span>}
              </span>
              {opt.id === selectedId && <Check className="h-4 w-4 shrink-0 text-brand-gold-dark" aria-hidden="true" />}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-text-muted">{noMatchesLabel}</li>
        )}
      </ul>
    </div>
  )
}
