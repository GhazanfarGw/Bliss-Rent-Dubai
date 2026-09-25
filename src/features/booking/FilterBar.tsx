import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { Dialog } from '@/features/shared/ui/Dialog'
import { FilterPanel, type FilterOptions } from '@/features/booking/FilterPanel'
import { categoryLabel } from '@/lib/categoryName'
import { activeFilterCount, sortCategoriesPremiumFirst } from '@/lib/vehicleFilters'
import { EMPTY_FILTERS, type SortOption, type VehicleFilters } from '@/types/domain'

interface FilterControlProps extends FilterOptions {
  filters: VehicleFilters
  sort: SortOption
  onFiltersChange: (filters: VehicleFilters) => void
  onSortChange: (sort: SortOption) => void
}

/** Clears every filter except the category, which the chips / rail list manage on their own. */
const clearedKeepingCategory = (filters: VehicleFilters): VehicleFilters => ({ ...EMPTY_FILTERS, categoryId: filters.categoryId })

/**
 * The desktop column beside the results: it sticks while the page scrolls, so
 * whatever is stacked in it (the trip summary, then the filters) stays in view.
 * The last child, normally {@link FilterRail}, takes the remaining height and
 * scrolls internally when the filters are taller than the screen. Hidden below
 * `lg`, where {@link FilterToolbar} takes over.
 */
export function RailColumn({ children }: { children: ReactNode }) {
  return (
    <div className="hidden lg:sticky lg:top-[calc(var(--header-h)+1.25rem)] lg:flex lg:max-h-[calc(100dvh-var(--header-h)-2.5rem)] lg:flex-col lg:gap-4">
      {children}
    </div>
  )
}

/** The filter card that fills the rest of a {@link RailColumn}. */
export function FilterRail(props: FilterControlProps) {
  const { t } = useTranslation()
  const { filters, onFiltersChange } = props
  const active = activeFilterCount(filters)

  return (
    <aside
      aria-label={t('searchResults.filters.title')}
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-brand-navy/10 bg-white shadow-(--shadow-card)"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-navy/10 bg-white px-5 py-4 text-brand-navy">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
          {t('searchResults.filters.title')}
          {active > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-white">{active}</span>}
        </h2>
        {active > 0 && (
          <button
            type="button"
            onClick={() => onFiltersChange(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-gold-dark underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            {t('searchResults.filters.clear')}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        <FilterPanel {...props} onChange={onFiltersChange} />
      </div>
    </aside>
  )
}

/**
 * Phone / tablet filtering: one slim sticky strip of category chips plus a
 * "Filter" button that opens every other filter (and the sort order) in a
 * bottom sheet. Hidden from `lg` up, where the rail replaces it. `tripSlot`
 * (the trip summary) rides above the chips, so it stays pinned as well.
 *
 * It renders a full-bleed sticky strip, so it must sit directly inside a
 * tall page wrapper (an `overflow` ancestor would stop it sticking).
 */
export function FilterToolbar({ tripSlot, ...props }: FilterControlProps & { tripSlot?: ReactNode }) {
  const { t } = useTranslation()
  const { categories, facets, totalCount, filters, sort, onFiltersChange, onSortChange } = props
  const [open, setOpen] = useState(false)
  // The chips show the category themselves, so the button badge counts the rest.
  const active = activeFilterCount(filters, { includeCategory: false })

  return (
    <>
      <div className="sticky top-[var(--header-h)] z-30 border-b border-brand-navy/10 bg-white/95 backdrop-blur-xl lg:hidden">
        {tripSlot && <div className="mx-auto max-w-7xl px-4 pt-2.5 sm:px-6">{tripSlot}</div>}
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <nav
            aria-label={t('searchResults.filters.quickCategories')}
            className="-mx-1 min-w-0 flex-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex w-max gap-2">
              <CategoryChip
                active={!filters.categoryId}
                label={t('searchResults.filters.allCategoriesChip')}
                count={totalCount}
                onClick={() => onFiltersChange({ ...filters, categoryId: null })}
              />
              {sortCategoriesPremiumFirst(categories).map((category) => (
                <CategoryChip
                  key={category.id}
                  active={filters.categoryId === category.id}
                  label={categoryLabel(t, category.name)}
                  count={facets.category[category.id] ?? 0}
                  onClick={() => onFiltersChange({ ...filters, categoryId: category.id })}
                />
              ))}
            </div>
          </nav>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-brand-navy/12 bg-white px-3.5 text-xs font-semibold text-brand-navy transition-colors hover:border-brand-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-brand-gold-dark" aria-hidden="true" />
            {t('searchResults.filters.button')}
            {active > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-gold px-1 text-[10px] font-bold text-white">{active}</span>}
          </button>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('searchResults.filters.title')}
        closeLabel={t('common.close')}
        mobileSheet
        maxWidthClassName="max-w-md"
      >
        <FilterPanel {...props} onChange={onFiltersChange} hideCategory />

        <div className="border-t border-brand-navy/10 pt-4">
          <SortSelect sort={sort} onChange={onSortChange} className="w-full" />
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-4 grid grid-cols-2 gap-3 border-t border-brand-navy/10 bg-surface px-6 py-4">
          <button
            type="button"
            onClick={() => onFiltersChange(clearedKeepingCategory(filters))}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-brand-navy/15 bg-white px-4 text-sm font-semibold text-brand-navy"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            {t('searchResults.filters.clear')}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-12 rounded-full bg-brand-gold px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(92,9,49,0.2)]"
          >
            {t('searchResults.filters.apply')}
          </button>
        </div>
      </Dialog>
    </>
  )
}

/**
 * What is currently filtered, each as a chip that removes itself. It renders
 * nothing while no filter is active, so the results start level with the
 * filter rail instead of under an empty strip. The sort order lives in the
 * page header ({@link SortField}) rather than here.
 */
export function ResultsBar({
  filters,
  categories,
  currency,
  onFiltersChange,
}: {
  filters: VehicleFilters
  categories: { id: string; name: string }[]
  currency: string
  onFiltersChange: (filters: VehicleFilters) => void
}) {
  const { t } = useTranslation()
  const money = (amount: number) => `${currency} ${amount.toLocaleString()}`

  const chips: { key: string; label: string; onRemove: () => void; desktopOnly?: boolean }[] = []
  if (filters.categoryId) {
    const name = categories.find((category) => category.id === filters.categoryId)?.name
    chips.push({
      key: 'category',
      label: name ? categoryLabel(t, name) : filters.categoryId,
      onRemove: () => onFiltersChange({ ...filters, categoryId: null }),
      desktopOnly: true, // phones already show the selected category chip in the sticky strip
    })
  }
  for (const brand of filters.brands) {
    chips.push({ key: `brand-${brand}`, label: brand, onRemove: () => onFiltersChange({ ...filters, brands: filters.brands.filter((b) => b !== brand) }) })
  }
  if (filters.transmission) {
    chips.push({
      key: 'transmission',
      label: t(`vehicleCard.transmission.${filters.transmission}`, { defaultValue: filters.transmission }),
      onRemove: () => onFiltersChange({ ...filters, transmission: null }),
    })
  }
  if (filters.minSeats != null) {
    chips.push({
      key: 'seats',
      label: t('searchResults.filters.seatsChip', { count: filters.minSeats }),
      onRemove: () => onFiltersChange({ ...filters, minSeats: null }),
    })
  }
  if (filters.priceMin != null || filters.priceMax != null) {
    const label =
      filters.priceMin != null && filters.priceMax != null
        ? `${money(filters.priceMin)} – ${money(filters.priceMax)}`
        : filters.priceMin != null
          ? t('searchResults.filters.priceFrom', { price: money(filters.priceMin) })
          : t('searchResults.filters.priceUpTo', { price: money(filters.priceMax!) })
    chips.push({ key: 'price', label, onRemove: () => onFiltersChange({ ...filters, priceMin: null, priceMax: null }) })
  }
  if (filters.availability) {
    chips.push({
      key: 'availability',
      label: t(`searchResults.filters.${filters.availability}`),
      onRemove: () => onFiltersChange({ ...filters, availability: null }),
    })
  }

  if (chips.length === 0) return null

  // A lone category chip is desktop-only, so on phones that leaves nothing to show.
  const showOnPhones = chips.some((chip) => !chip.desktopOnly)

  return (
    <div className={'mb-4 flex-wrap items-center gap-2 ' + (showOnPhones ? 'flex' : 'hidden lg:flex')}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          aria-label={t('searchResults.filters.remove', { label: chip.label })}
          className={
            'items-center gap-1.5 rounded-full border border-brand-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy transition-colors hover:border-brand-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ' +
            (chip.desktopOnly ? 'hidden lg:inline-flex' : 'inline-flex')
          }
        >
          {chip.label}
          <X className="h-3 w-3 text-brand-navy/50" aria-hidden="true" />
        </button>
      ))}
      {activeFilterCount(filters) > 1 && (
        <button
          type="button"
          onClick={() => onFiltersChange(EMPTY_FILTERS)}
          className="px-1 text-xs font-semibold text-brand-gold-dark underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
        >
          {t('searchResults.filters.clear')}
        </button>
      )}
    </div>
  )
}

/**
 * The desktop sort control, at the right of the page title: a small "Sort by"
 * caption over the chosen order. The whole box is the select, so a click
 * anywhere on it opens the list. Below `lg` the sort lives in the filter
 * sheet instead, so this stays hidden.
 */
export function SortField({ sort, onChange, disabled = false }: { sort: SortOption; onChange: (sort: SortOption) => void; disabled?: boolean }) {
  const { t } = useTranslation()
  return (
    <label
      className={
        'relative hidden min-h-14 min-w-56 rounded-xl border border-brand-navy/15 bg-white transition-colors focus-within:ring-2 focus-within:ring-brand-gold lg:block ' +
        (disabled ? 'opacity-60' : 'hover:border-brand-gold')
      }
    >
      <span className="pointer-events-none absolute start-4 top-2.5 text-[11px] leading-none text-text-muted">{t('searchResults.filters.sortBy')}</span>
      <select
        value={sort}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as SortOption)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent pb-0.5 ps-4 pe-10 pt-5 text-sm font-medium text-brand-navy outline-none disabled:cursor-default"
      >
        <option value="price_asc">{t('searchResults.filters.priceLowHigh')}</option>
        <option value="price_desc">{t('searchResults.filters.priceHighLow')}</option>
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy/50" aria-hidden="true" />
    </label>
  )
}

function CategoryChip({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ' +
        (active
          ? 'border-brand-gold bg-brand-gold/8 text-brand-gold'
          : 'border-brand-navy/12 bg-white text-brand-navy hover:border-brand-gold')
      }
    >
      {label}{' '}
      <span className={'text-[11px] font-bold ' + (active ? 'text-brand-gold' : 'text-text-muted')}>{count}</span>
    </button>
  )
}

function SortSelect({ sort, onChange, className = '' }: { sort: SortOption; onChange: (sort: SortOption) => void; className?: string }) {
  const { t } = useTranslation()
  return (
    <label className={'relative block ' + className}>
      <span className="sr-only">{t('searchResults.filters.sortBy')}</span>
      <select
        value={sort}
        onChange={(event) => onChange(event.target.value as SortOption)}
        className="h-10 w-full appearance-none rounded-lg border border-brand-navy/12 bg-white ps-3 pe-9 text-[13px] font-semibold text-brand-navy outline-none transition hover:border-brand-navy/30 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
      >
        <option value="price_asc">{t('searchResults.filters.priceLowHigh')}</option>
        <option value="price_desc">{t('searchResults.filters.priceHighLow')}</option>
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-navy/50" aria-hidden="true" />
    </label>
  )
}
