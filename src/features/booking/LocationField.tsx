import { useRef, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Check, ChevronRight, Hotel, Plane, Search, Truck } from 'lucide-react'
import { Dialog } from '@/features/shared/ui/Dialog'
import { FieldPopover } from '@/features/shared/ui/FieldPopover'
import { inputClass } from '@/features/shared/ui/inputClasses'
import { BarTrigger } from '@/features/booking/SearchBarField'
import { BAR_BORDER } from '@/features/booking/searchBarStyles'
import { TYPE_ICON, TYPE_ORDER, typeOrderIndex } from '@/features/booking/locationDisplay'
import type { LocationType } from '@/types/database'
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
  /**
   * Controlled open state. When provided (together with `onOpenChange`), the
   * parent drives when this field's sheet is open — used by the row-layout
   * guided search flow so that finishing one field automatically opens the
   * next one, instead of the visitor having to tap each trigger in turn.
   * Omit both to keep this field's default, independently-managed behavior
   * (unchanged, still used by the card/navigator layouts).
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Homepage search-bar segment (Qatar-style) — dropdown panel under the field instead of a modal sheet. */
  bar?: boolean
  /** `bar` only: segment wrapper classes (width, dividers) from the bar layout. */
  className?: string
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
  open: controlledOpen,
  onOpenChange,
  bar = false,
  className = '',
}: LocationPickerButtonProps) {
  const { t } = useTranslation()
  const anchorRef = useRef<HTMLDivElement>(null)
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const sheetOpen = isControlled ? controlledOpen : internalOpen
  function setSheetOpen(next: boolean) {
    if (isControlled) onOpenChange?.(next)
    else setInternalOpen(next)
  }
  const disabled = loading || !!error
  const sorted = options
    .slice()
    .sort((a, b) => typeOrderIndex(a.type) - typeOrderIndex(b.type) || a.name.localeCompare(b.name))
  const selected = sorted.find((l) => l.id === locationId) ?? null

  if (bar) {
    return (
      <div ref={anchorRef} className={'relative ' + className}>
        <BarTrigger
          label={label}
          value={loading ? t('searchWidget.loadingLocations') : selected ? selected.name : placeholder}
          placeholder={!selected}
          open={sheetOpen}
          onClick={() => setSheetOpen(true)}
          disabled={disabled}
          wrap
        />
        <FieldPopover
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={sheetTitle}
          closeLabel={t('common.close')}
          anchorRef={anchorRef}
          widthClassName="w-[26rem]"
        >
          <BarLocationList
            options={sorted}
            selectedId={locationId}
            onSelect={(id) => {
              onLocationChange(id)
              setSheetOpen(false)
            }}
          />
        </FieldPopover>
      </div>
    )
  }

  return (
    <div className={row ? 'flex w-full min-w-0 flex-col gap-1 sm:flex-1 sm:min-w-[190px]' : fluid ? 'flex w-full min-w-0 flex-col gap-1' : 'flex w-full flex-col gap-1 sm:w-64'}>
      <span className="block text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        disabled={disabled}
        aria-expanded={sheetOpen}
        className={
          'flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-start text-sm text-brand-navy outline-none transition-colors focus:border-brand-navy focus:ring-1 focus:ring-brand-navy disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted ' +
          (sheetOpen ? 'border-brand-gold ring-1 ring-brand-gold' : 'border-border')
        }
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

const TYPE_LINE_ICON: Record<LocationType, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  airport: Plane,
  city: Building2,
  hotel: Hotel,
  delivery: Truck,
}

/**
 * The search bar's location dropdown, after Qatar Airways' airport list: a
 * search box, then the points grouped under small type headings (Airport,
 * City / Area, …), each row a line icon, the name in bold with its city
 * underneath, and the airport code on the far side.
 */
function BarLocationList({ options, selectedId, onSelect }: { options: Location[]; selectedId: string; onSelect: (id: string) => void }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter((l) => [l.name, l.city, l.airport_code ?? ''].some((s) => s.toLowerCase().includes(q)))
    : options
  const groups = TYPE_ORDER.map((type) => ({ type, items: filtered.filter((l) => l.type === type) })).filter((g) => g.items.length > 0)

  return (
    <div className="lg:p-2">
      {/* Phone sheet: the search box stays pinned while the list scrolls under it. */}
      <div className="sticky top-0 z-10 bg-white pb-2 lg:relative lg:pb-0">
        <Search className="pointer-events-none absolute start-3 top-[1.3rem] h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        <input
          data-autofocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchWidget.searchLocations')}
          aria-label={t('searchWidget.searchLocations')}
          className={'w-full rounded-lg border bg-white py-2.5 pe-3 ps-9 text-sm text-brand-navy outline-none placeholder:text-text-muted focus:border-brand-navy focus:ring-1 focus:ring-brand-navy ' + BAR_BORDER}
        />
      </div>

      <div className="lg:mt-1 lg:max-h-80 lg:overflow-y-auto">
        {groups.map((group) => (
          <div key={group.type}>
            <p className="px-3 pb-1 pt-3 text-xs text-text-muted">{t(`searchWidget.type.${group.type}`)}</p>
            <ul>
              {group.items.map((loc) => {
                const Icon = TYPE_LINE_ICON[loc.type]
                const isSelected = loc.id === selectedId
                return (
                  <li key={loc.id} className="border-b border-[#efece7] last:border-b-0">
                    <button
                      type="button"
                      data-option
                      data-selected={isSelected || undefined}
                      aria-current={isSelected || undefined}
                      onClick={() => onSelect(loc.id)}
                      className={
                        'my-0.5 flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start outline-none transition-colors hover:bg-brand-lavender focus-visible:bg-brand-lavender focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-navy ' +
                        (isSelected ? 'bg-brand-lavender' : '')
                      }
                    >
                      <Icon className="h-5 w-5 shrink-0 text-text-muted" aria-hidden={true} />
                      <span className="min-w-0 flex-1">
                        {/* Wraps rather than truncates: names like "…(DXB) — Terminal 1/3" only differ at the end. */}
                        <span className="block text-sm font-semibold text-brand-navy">{loc.name}</span>
                        <span className="block truncate text-xs text-text-muted">{loc.city}</span>
                      </span>
                      {loc.airport_code && <span className="shrink-0 text-sm font-semibold text-brand-navy">{loc.airport_code}</span>}
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {groups.length === 0 && <p className="px-3 py-6 text-center text-sm text-text-muted">{t('searchWidget.noMatches')}</p>}
      </div>
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
