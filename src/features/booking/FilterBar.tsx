import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDownWideNarrow, SlidersHorizontal, X } from 'lucide-react'
import { Dialog } from '@/features/shared/ui/Dialog'
import type { SortOption, VehicleFilters } from '@/types/domain'

interface FilterBarProps {
  categories: { id: string; name: string }[]
  brands: string[]
  transmissions: string[]
  filters: VehicleFilters
  sort: SortOption
  resultCount: number
  onFiltersChange: (filters: VehicleFilters) => void
  onSortChange: (sort: SortOption) => void
  /** Only shown once the customer has chosen dates — see VehicleSearchResult. */
  showAvailabilityFilter?: boolean
}

/**
 * Every filter here maps to a real column (category, make, transmission).
 * There is no "vehicle type" or feature filter because no such column
 * exists in the schema.
 */
export function FilterBar({
  categories,
  brands,
  transmissions,
  filters,
  sort,
  resultCount,
  onFiltersChange,
  onSortChange,
  showAvailabilityFilter = false,
}: FilterBarProps) {
  const { t } = useTranslation()
  const activeFilterCount = [filters.categoryId, filters.brand, filters.transmission, filters.availability].filter(Boolean).length
  const hasActiveFilters = activeFilterCount > 0
  const [mobileOpen, setMobileOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState(filters)

  const clearFilters = () => {
    const cleared = { categoryId: null, brand: null, transmission: null, availability: null }
    setDraftFilters(cleared)
    onFiltersChange(cleared)
  }

  return (
    <>
      <aside className="hidden rounded-none border border-[#eadfcf] bg-surface-warm-alt p-4 shadow-none lg:sticky lg:top-[82px] lg:z-20 lg:self-start lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <div className="flex items-start justify-between gap-2 border-b border-brand-navy/10 pb-4">
          <div>
            <h2 className="flex items-center gap-1.5 text-base font-semibold text-brand-navy">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
              {t('searchResults.filters.title')}
            </h2>
            <p className="mt-1 text-xs text-brand-navy/60">{t('searchResults.resultsCount', { count: resultCount })}</p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-none px-2.5 py-1 text-xs font-semibold text-brand-navy underline-offset-2 hover:bg-[#f3e1b7] hover:underline focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('searchResults.filters.clear')}
            </button>
          )}
        </div>
        <div className="desktop-filter-options mt-4 max-h-[calc(100vh-16rem)] overflow-y-hidden pe-1 hover:overflow-y-auto focus-within:overflow-y-auto">
          <DropdownFilters
            categories={categories}
            brands={brands}
            transmissions={transmissions}
            showAvailabilityFilter={showAvailabilityFilter}
            filters={filters}
            onChange={onFiltersChange}
            compact
          />
        </div>
<label className="mt-4 flex flex-col gap-2 border-t border-brand-navy/10 pt-4 text-xs font-semibold text-brand-navy/70">
          <span className="inline-flex items-center gap-1.5">
            <ArrowDownWideNarrow className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
            {t('searchResults.filters.sortBy')}
          </span>
          <select value={sort} onChange={(e) => onSortChange(e.target.value as SortOption)} className="min-h-11 rounded-none border border-[#d9cbb8] bg-white px-3 text-sm text-brand-navy outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30">
            <option value="price_asc">{t('searchResults.filters.priceLowHigh')}</option>
            <option value="price_desc">{t('searchResults.filters.priceHighLow')}</option>
          </select>
        </label>
      </aside>

      <div className="sticky top-16 z-20 -mx-4 border-y border-brand-gold/20 bg-white px-4 py-3 text-black lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-black">{t('searchResults.resultsCount', { count: resultCount })}</span>
          <button type="button" onClick={() => { setDraftFilters(filters); setMobileOpen(true) }} aria-expanded={mobileOpen} className="inline-flex min-h-11 items-center gap-2 rounded-none bg-brand-gold px-4 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(92,9,49,0.25)] focus:outline-none focus:ring-2 focus:ring-brand-gold">
            <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t('searchResults.filters.button')}
            {hasActiveFilters && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-none bg-white px-1 text-[11px] font-bold text-brand-gold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        {hasActiveFilters && <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{[filters.categoryId, filters.brand, filters.transmission, filters.availability].filter(Boolean).map((filter) => <span key={filter} className="shrink-0 rounded-none bg-brand-gold/10 px-3 py-1 text-xs font-medium text-brand-navy">{filter}</span>)}</div>}
      </div>

      <Dialog open={mobileOpen} onClose={() => setMobileOpen(false)} title={t('searchResults.filters.title')} closeLabel={t('common.close')} mobileSheet maxWidthClassName="max-w-xl">
        <div className="space-y-5">
          <DropdownFilters
            categories={categories}
            brands={brands}
            transmissions={transmissions}
            showAvailabilityFilter={showAvailabilityFilter}
            filters={draftFilters}
            onChange={(next) => {
              setDraftFilters(next)
              onFiltersChange(next)
            }}
          />
          <label className="flex flex-col gap-2 text-xs font-semibold text-brand-navy/70">
            <span className="inline-flex items-center gap-1.5">
              <ArrowDownWideNarrow className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
              {t('searchResults.filters.sortBy')}
            </span>
            <select value={sort} onChange={(e) => onSortChange(e.target.value as SortOption)} className="min-h-11 w-full rounded-none border border-[#d9cbb8] bg-white px-3 text-sm font-normal text-brand-navy outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30">
              <option value="price_asc">{t('searchResults.filters.priceLowHigh')}</option>
              <option value="price_desc">{t('searchResults.filters.priceHighLow')}</option>
            </select>
          </label>
          <div className="flex gap-3 border-t border-border pt-4">
            <button type="button" onClick={clearFilters} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-none border border-brand-navy/15 px-4 text-sm font-semibold text-brand-navy">
              <X className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t('searchResults.filters.clear')}
            </button>
            <button
              type="button"
              onClick={() => { onFiltersChange(draftFilters); setMobileOpen(false) }}
              className="min-h-11 flex-1 rounded-none bg-brand-gold px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(92,9,49,0.2)]"
            >
              {t('searchResults.filters.apply')}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  )
}

function DropdownFilters({
  categories,
  brands,
  transmissions,
  showAvailabilityFilter,
  filters,
  onChange,
  compact = false,
}: {
  categories: { id: string; name: string }[]
  brands: string[]
  transmissions: string[]
  showAvailabilityFilter: boolean
  filters: VehicleFilters
  onChange: (filters: VehicleFilters) => void
  compact?: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-5">
      {showAvailabilityFilter && (
        <DropdownField
          label={t('searchResults.filters.availability')}
          value={filters.availability}
          options={[
            { value: 'available', label: t('searchResults.filters.available') },
            { value: 'reserved', label: t('searchResults.filters.reserved') },
          ]}
          allLabel={t('searchResults.filters.allAvailability')}
          compact={compact}
          onChange={(value) => onChange({ ...filters, availability: value as VehicleFilters['availability'] })}
        />
      )}
      <DropdownField
        label={t('searchResults.filters.category')}
        value={filters.categoryId}
        options={categories.map((category) => ({ value: category.id, label: category.name }))}
        allLabel={t('searchResults.filters.allCategories')}
        compact={compact}
        onChange={(value) => onChange({ ...filters, categoryId: value })}
      />
      <DropdownField
        label={t('searchResults.filters.brand')}
        value={filters.brand}
        options={brands.map((brand) => ({ value: brand, label: brand }))}
        allLabel={t('searchResults.filters.allBrands')}
        compact={compact}
        onChange={(value) => onChange({ ...filters, brand: value })}
      />
      <DropdownField
        label={t('searchResults.filters.transmission')}
        value={filters.transmission}
        options={transmissions.map((transmission) => ({ value: transmission, label: transmission }))}
        allLabel={t('searchResults.filters.allTransmissions')}
        compact={compact}
        onChange={(value) => onChange({ ...filters, transmission: value })}
      />
    </div>
  )
}

function DropdownField({
  label,
  value,
  options,
  allLabel,
  onChange,
  compact = false,
}: {
  label: string
  value: string | null
  options: { value: string; label: string }[]
  allLabel: string
  onChange: (value: string | null) => void
  compact?: boolean
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-brand-navy">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={
          'mt-2 block w-full rounded-none border border-[#d9cbb8] bg-white px-3 text-sm text-brand-navy outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/25 ' +
          (compact ? 'min-h-10' : 'min-h-11')
        }
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
