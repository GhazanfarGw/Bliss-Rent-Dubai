import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Search } from 'lucide-react'
import { categoryLabel } from '@/lib/categoryName'
import { CurrencySymbol } from '@/features/shared/ui/CurrencySymbol'
import { sortCategoriesPremiumFirst } from '@/lib/vehicleFilters'
import type { VehicleFilters } from '@/types/domain'

/** How many cars each option would leave on screen given every other active filter. */
export interface FacetCounts {
  category: Record<string, number>
  brand: Record<string, number>
  transmission: Record<string, number>
  /** Keyed by the minimum seat count. */
  seats: Record<number, number>
}

/** Everything the filter controls are built from — all of it derived from the loaded fleet. */
export interface FilterOptions {
  categories: { id: string; name: string }[]
  brands: string[]
  transmissions: string[]
  seatOptions: number[]
  priceBounds: { min: number; max: number } | null
  currency: string
  facets: FacetCounts
  /** Cars across every category under the other active filters. */
  totalCount: number
  showAvailabilityFilter: boolean
}

interface FilterPanelProps extends FilterOptions {
  filters: VehicleFilters
  onChange: (filters: VehicleFilters) => void
  /** The phone sheet has category chips above it, so it leaves the category list out. */
  hideCategory?: boolean
}

/** Show a search box once the brand list is long enough to need one. */
const BRAND_SEARCH_THRESHOLD = 8

/**
 * Every filter the fleet can be narrowed by, as stacked, collapsible sections.
 * Shared by the desktop rail and the phone sheet so both offer the same controls.
 * Only ever offers values that exist in the loaded fleet, each with the number
 * of cars it would show; an option that would show none is greyed out.
 */
export function FilterPanel({
  categories,
  brands,
  transmissions,
  seatOptions,
  priceBounds,
  currency,
  facets,
  totalCount,
  showAvailabilityFilter,
  filters,
  onChange,
  hideCategory = false,
}: FilterPanelProps) {
  const { t } = useTranslation()
  const set = (patch: Partial<VehicleFilters>) => onChange({ ...filters, ...patch })

  // The smallest seat count is what "Any" already means, so it needs no chip.
  const seatChips = seatOptions.slice(1)

  return (
    <div>
      {showAvailabilityFilter && (
        <FilterSection title={t('searchResults.filters.availability')}>
          <Segmented
            label={t('searchResults.filters.availability')}
            value={filters.availability}
            options={[
              { value: null, label: t('searchResults.filters.any') },
              { value: 'available', label: t('searchResults.filters.available') },
              { value: 'reserved', label: t('searchResults.filters.reserved') },
            ]}
            onChange={(value) => set({ availability: value as VehicleFilters['availability'] })}
          />
        </FilterSection>
      )}

      {!hideCategory && (
        <FilterSection title={t('searchResults.filters.category')}>
          <div className="space-y-1">
            <OptionRow
              active={!filters.categoryId}
              label={t('searchResults.filters.allCategoriesChip')}
              count={totalCount}
              onClick={() => set({ categoryId: null })}
            />
            {sortCategoriesPremiumFirst(categories).map((category) => (
              <OptionRow
                key={category.id}
                active={filters.categoryId === category.id}
                label={categoryLabel(t, category.name)}
                count={facets.category[category.id] ?? 0}
                onClick={() => set({ categoryId: category.id })}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {priceBounds && priceBounds.max > priceBounds.min && (
        <FilterSection title={t('searchResults.filters.price')} badge={filters.priceMin != null || filters.priceMax != null ? 1 : 0}>
          <PriceRange
            bounds={priceBounds}
            currency={currency}
            min={filters.priceMin}
            max={filters.priceMax}
            onChange={(priceMin, priceMax) => set({ priceMin, priceMax })}
          />
        </FilterSection>
      )}

      {seatChips.length > 0 && (
        <FilterSection title={t('searchResults.filters.seats')}>
          <Segmented
            label={t('searchResults.filters.seats')}
            value={filters.minSeats == null ? null : String(filters.minSeats)}
            options={[
              { value: null, label: t('searchResults.filters.any') },
              ...seatChips.map((seats) => ({
                value: String(seats),
                label: t('searchResults.filters.seatsMin', { count: seats }),
                disabled: (facets.seats[seats] ?? 0) === 0,
              })),
            ]}
            onChange={(value) => set({ minSeats: value == null ? null : Number(value) })}
          />
        </FilterSection>
      )}

      {transmissions.length > 1 && (
        <FilterSection title={t('searchResults.filters.transmission')}>
          <Segmented
            label={t('searchResults.filters.transmission')}
            value={filters.transmission}
            options={[
              { value: null, label: t('searchResults.filters.any') },
              ...transmissions.map((transmission) => ({
                value: transmission,
                label: t(`vehicleCard.transmission.${transmission}`, { defaultValue: transmission }),
                disabled: (facets.transmission[transmission] ?? 0) === 0,
              })),
            ]}
            onChange={(value) => set({ transmission: value })}
          />
        </FilterSection>
      )}

      {brands.length > 0 && (
        <FilterSection title={t('searchResults.filters.brand')} badge={filters.brands.length}>
          <BrandList
            brands={brands}
            selected={filters.brands}
            counts={facets.brand}
            onChange={(next) => set({ brands: next })}
          />
        </FilterSection>
      )}
    </div>
  )
}

/** A collapsible group. Native <details> keeps it keyboard- and screen-reader-friendly for free. */
function FilterSection({ title, badge = 0, children }: { title: string; badge?: number; children: ReactNode }) {
  return (
    <details open className="group border-b border-brand-navy/10 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-4 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{title}</span>
        {badge > 0 && <span className="grid h-5 min-w-5 place-items-center bg-brand-gold px-1 text-[10px] font-bold text-white">{badge}</span>}
        <ChevronDown className="h-4 w-4 shrink-0 text-brand-navy/45 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  )
}

/** A single-choice row with its car count — used for the category list. */
function OptionRow({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  const empty = count === 0 && !active
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={empty}
      onClick={onClick}
      className={
        'flex w-full items-center justify-between gap-3 border px-3 py-2 text-start text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold disabled:cursor-not-allowed disabled:opacity-40 ' +
        (active
          ? 'border-brand-gold bg-brand-gold/8 text-brand-gold'
          : 'border-transparent text-brand-navy hover:border-brand-navy/15 hover:bg-[#f5f3ef]')
      }
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className={'shrink-0 text-[11px] font-bold ' + (active ? 'text-brand-gold' : 'text-text-muted')}>{count}</span>
    </button>
  )
}

/** A row of mutually exclusive buttons, with `null` meaning "no filter". */
function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | null
  options: { value: string | null; label: string; disabled?: boolean }[]
  onChange: (value: string | null) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value ?? 'any'}
            type="button"
            aria-pressed={active}
            disabled={option.disabled && !active}
            onClick={() => onChange(option.value)}
            className={
              'min-h-10 min-w-12 flex-1 basis-auto border px-2.5 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold disabled:cursor-not-allowed disabled:opacity-40 ' +
              (active
                ? 'border-brand-gold bg-brand-gold/8 text-brand-gold'
                : 'border-brand-navy/12 bg-white text-brand-navy hover:border-brand-gold')
            }
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Multi-select brand checkboxes with counts, plus a search box when there are many. */
function BrandList({
  brands,
  selected,
  counts,
  onChange,
}: {
  brands: string[]
  selected: string[]
  counts: Record<string, number>
  onChange: (brands: string[]) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const visible = needle ? brands.filter((brand) => brand.toLowerCase().includes(needle)) : brands

  const toggle = (brand: string) =>
    onChange(selected.includes(brand) ? selected.filter((current) => current !== brand) : [...selected, brand])

  return (
    <div>
      {brands.length > BRAND_SEARCH_THRESHOLD && (
        <label className="relative mb-2 block">
          <span className="sr-only">{t('searchResults.filters.searchBrands')}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy/40" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchResults.filters.searchBrands')}
            className="h-10 w-full border border-brand-navy/12 bg-[#f8f6f2] ps-9 pe-3 text-[13px] text-brand-navy outline-none placeholder:text-text-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
          />
        </label>
      )}

      <ul className="-me-2 max-h-48 space-y-0.5 overflow-y-auto pe-2">
        {visible.map((brand) => {
          const checked = selected.includes(brand)
          const count = counts[brand] ?? 0
          const empty = count === 0 && !checked
          return (
            <li key={brand}>
              <label
                className={
                  'flex cursor-pointer items-center gap-3 px-1 py-2 text-[13px] font-medium text-brand-navy transition-colors hover:bg-[#f5f3ef] ' +
                  (empty ? 'cursor-not-allowed opacity-40' : '')
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={empty}
                  onChange={() => toggle(brand)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="grid h-[18px] w-[18px] shrink-0 place-items-center border border-brand-navy/25 bg-white text-transparent transition-colors peer-checked:border-brand-gold peer-checked:bg-brand-gold peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-gold peer-focus-visible:ring-offset-1"
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1 truncate">{brand}</span>
                <span className="shrink-0 text-[11px] font-bold text-text-muted">{count}</span>
              </label>
            </li>
          )
        })}
        {visible.length === 0 && <li className="px-1 py-2 text-[13px] text-text-muted">{t('searchResults.filters.noBrands')}</li>}
      </ul>
    </div>
  )
}

/** Min / max per-day price boxes, with the fleet's real range as the placeholder and hint. */
function PriceRange({
  bounds,
  currency,
  min,
  max,
  onChange,
}: {
  bounds: { min: number; max: number }
  currency: string
  min: number | null
  max: number | null
  onChange: (min: number | null, max: number | null) => void
}) {
  const { t } = useTranslation()
  const parse = (raw: string) => (raw === '' || Number.isNaN(Number(raw)) ? null : Math.max(0, Number(raw)))

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <PriceInput
          label={t('searchResults.filters.priceMin')}
          currency={currency}
          value={min}
          placeholder={bounds.min}
          onChange={(raw) => onChange(parse(raw), max)}
        />
        <PriceInput
          label={t('searchResults.filters.priceMax')}
          currency={currency}
          value={max}
          placeholder={bounds.max}
          onChange={(raw) => onChange(min, parse(raw))}
        />
      </div>
      <p className="mt-2 text-[11px] leading-4 text-text-muted">
        {t('searchResults.filters.priceHint', { range: `${currency} ${bounds.min.toLocaleString()} – ${bounds.max.toLocaleString()}` })}
      </p>
    </div>
  )
}

function PriceInput({
  label,
  currency,
  value,
  placeholder,
  onChange,
}: {
  label: string
  currency: string
  value: number | null
  placeholder: number
  onChange: (raw: string) => void
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">{label}</span>
      <span className="relative mt-1 block">
        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-text-muted">
          <CurrencySymbol currency={currency} />
        </span>
        <input
          type="number"
          aria-label={label}
          inputMode="numeric"
          min={0}
          value={value ?? ''}
          placeholder={placeholder.toLocaleString()}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full border border-brand-navy/12 bg-[#f8f6f2] ps-11 pe-2 text-[13px] font-semibold text-brand-navy outline-none [appearance:textfield] placeholder:font-normal placeholder:text-text-muted/70 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </span>
    </label>
  )
}
