import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchLocations } from '@/features/booking/api'
import { validateDateRange } from '@/lib/dateRange'
import { DEFAULT_TIME } from '@/lib/timeOptions'
import { Button } from '@/features/shared/ui/Button'
import { DateRangePicker } from '@/features/booking/DateRangePicker'
import { CitySelect, LocationPickerButton } from '@/features/booking/LocationField'
import { TimeSelect } from '@/features/booking/TimeSelect'
import { sortByOrder } from '@/features/booking/locationDisplay'
import type { Location, SearchCriteria } from '@/types/domain'

/**
 * Bliss Rent operates in the United Arab Emirates only — there is no
 * country selector anywhere in this customer-facing widget, and none
 * should be added. `locations.country` still exists in the database
 * (every row is `'United Arab Emirates'`) and is still filtered on here,
 * purely as a defensive floor — it's just never exposed as a choice,
 * since there is only ever one value it could be. `city` stays free-text
 * and fully data-driven: whichever cities actually have locations today
 * (Dubai and Abu Dhabi) are what shows up, more appear the moment real
 * rows for them exist, and none of this list is ever hardcoded.
 *
 * Layout: a flat row of individually-labelled fields (Pickup City, Pickup
 * Location, an optional Return Location, the pickup/return date range,
 * Pickup Time, Search) — flexbox, not a grid, so the row wraps naturally
 * full-width per field on narrow screens and lays out as one line on
 * wider ones; nothing here ever scrolls horizontally. Then the "Same
 * Return Location" checkbox. Checked by default, the checkbox hides the
 * Return Location field entirely and reuses the pickup point for
 * drop-off, matching a standard one-city round trip; unchecking it
 * reveals a single Return Location field that searches every UAE location
 * directly (no separate return-city step), enabling a one-way rental.
 * Pickup Time is informational only — see src/lib/timeOptions.ts — and
 * never touches date validation, availability, or pricing, all of which
 * remain delegated to dateRange.ts unchanged. There is deliberately no
 * Return Time field: only the pickup time is customer-facing here.
 */
const UAE = 'United Arab Emirates'
const DEFAULT_CITY = 'Dubai'

interface SearchWidgetProps {
  initialValues?: Partial<SearchCriteria>
  onSearch: (criteria: SearchCriteria) => void
  /** Compact layout for the "edit search" bar on the results page. */
  compact?: boolean
  /**
   * 'grid' (default): the main booking-section widget.
   * 'row': the same flat-row field set at more compact widths (see the
   * `row` prop each field takes) — used by StickySearchBar so the sticky
   * bar stays visually tighter. Both wrap (flex-wrap) onto further lines
   * on narrow screens; neither ever scrolls horizontally. Same form,
   * state, and validation either way.
   */
  layout?: 'grid' | 'row'
}

export function SearchWidget({ initialValues, onSearch, compact = false, layout = 'grid' }: SearchWidgetProps) {
  const { t } = useTranslation()
  const [locations, setLocations] = useState<Location[]>([])
  const [locationsError, setLocationsError] = useState<string | null>(null)
  const [locationsLoading, setLocationsLoading] = useState(true)

  const [startDate, setStartDate] = useState(initialValues?.startDate ?? '')
  const [endDate, setEndDate] = useState(initialValues?.endDate ?? '')
  const [pickupCity, setPickupCity] = useState(DEFAULT_CITY)
  const [pickupLocationId, setPickupLocationId] = useState(initialValues?.pickupLocationId ?? '')
  const [returnLocationId, setReturnLocationId] = useState(initialValues?.dropoffLocationId ?? '')
  // Defaults to checked (a same-city round trip) unless we were handed an
  // existing search whose pickup/drop-off already differ — e.g. the "edit
  // search" bar on the results page reopening a one-way rental.
  const [sameReturnLocation, setSameReturnLocation] = useState(
    !initialValues?.dropoffLocationId || initialValues.dropoffLocationId === initialValues?.pickupLocationId,
  )
  const [pickupTime, setPickupTime] = useState(initialValues?.pickupTime ?? DEFAULT_TIME)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchLocations()
      .then((data) => {
        if (cancelled) return
        setLocations(data)
        setLocationsError(null)
        // Only the Pickup field has a city step, so only it needs matching
        // against an incoming initial value — the Return Location field
        // searches every UAE location directly (see LocationPickerButton).
        const uae = data.filter((l) => l.country === UAE)
        const pickupMatch = uae.find((l) => l.id === initialValues?.pickupLocationId)
        if (pickupMatch) setPickupCity(pickupMatch.city)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLocationsError(err instanceof Error ? err.message : 'Could not load locations.')
      })
      .finally(() => {
        if (!cancelled) setLocationsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only ever meant to run once on mount
  }, [])

  const uaeLocations = locations.filter((l) => l.country === UAE)
  const cities = Array.from(new Set(uaeLocations.map((l) => l.city))).sort((a, b) => sortByOrder(a, b, DEFAULT_CITY))
  const pickupCityLocations = uaeLocations.filter((l) => l.city === pickupCity)

  function handlePickupCityChange(city: string) {
    setPickupCity(city)
    // A previously-chosen point may not exist in the new city.
    setPickupLocationId('')
  }

  const dropoffLocationId = sameReturnLocation ? pickupLocationId : returnLocationId
  const dateValidation = validateDateRange(startDate, endDate)
  const missingLocation = !pickupLocationId || !dropoffLocationId
  const canSubmit = dateValidation.valid && !missingLocation && !locationsLoading

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!canSubmit) return
    onSearch({ startDate, endDate, pickupLocationId, dropoffLocationId, pickupTime })
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const fieldRow = layout === 'row'

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={
        'w-full rounded-[1.8rem] border border-[#dfe2de] bg-[#f7f7f5] shadow-[0_12px_30px_rgba(15,18,22,0.05)] ' +
        (compact ? 'p-3 sm:p-4' : 'p-5 sm:p-6')
      }
    >
      <div className={fieldRow ? 'flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:flex-nowrap' : 'flex flex-wrap items-end gap-3'}>
        <CitySelect
          label={t('searchWidget.pickupCity')}
          ariaLabel={t('searchWidget.pickupCity')}
          value={pickupCity}
          onChange={handlePickupCityChange}
          cities={cities}
          disabled={locationsLoading || !!locationsError}
          row={fieldRow}
        />

        <LocationPickerButton
          label={t('searchWidget.pickupLocation')}
          locationId={pickupLocationId}
          onLocationChange={setPickupLocationId}
          options={pickupCityLocations}
          loading={locationsLoading}
          error={locationsError}
          placeholder={t('searchWidget.selectPickup')}
          sheetTitle={t('searchWidget.choosePickupLocation')}
          row={fieldRow}
        />

        {!sameReturnLocation && (
          <LocationPickerButton
            label={t('searchWidget.returnLocation')}
            locationId={returnLocationId}
            onLocationChange={setReturnLocationId}
            options={uaeLocations}
            loading={locationsLoading}
            error={locationsError}
            placeholder={t('searchWidget.selectReturnLocation')}
            sheetTitle={t('searchWidget.chooseReturnLocation')}
            row={fieldRow}
          />
        )}

        <div className={fieldRow ? 'min-w-0 flex-1 sm:min-w-[220px]' : 'w-full sm:w-64'}>
          <DateRangePicker
            row
            startDate={startDate}
            endDate={endDate}
            onChange={(next) => {
              setStartDate(next.startDate)
              setEndDate(next.endDate)
            }}
            todayIso={todayIso}
          />
        </div>

        <TimeSelect
          label={t('searchWidget.pickupTime')}
          ariaLabel={t('searchWidget.pickupTime')}
          value={pickupTime}
          onChange={setPickupTime}
          row={fieldRow}
        />

        <Button type="submit" fullWidthOnMobile={fieldRow} className={fieldRow ? 'mb-px shrink-0' : undefined}>
          {t('searchWidget.searchCars')}
        </Button>
      </div>

      <label className={(fieldRow ? 'mt-2' : 'mt-3') + ' flex w-fit cursor-pointer items-center gap-3 text-[0.95rem] font-medium text-[#2d3948]'}>
        <input
          type="checkbox"
          checked={sameReturnLocation}
          onChange={(e) => setSameReturnLocation(e.target.checked)}
          className="h-4 w-4 rounded border-border text-brand-navy focus:ring-brand-navy"
        />
        {t('searchWidget.sameReturnLocation')}
      </label>

      {touched && dateValidation.error && (
        <p className="mt-3 text-sm font-medium text-error">{t('errors.dateRange.' + dateValidation.error)}</p>
      )}
      {touched && !dateValidation.error && missingLocation && (
        <p className="mt-3 text-sm font-medium text-error">{t('searchWidget.bothLocationsRequired')}</p>
      )}
      {locationsError && (
        <p className="mt-3 text-sm font-medium text-error">
          {t('searchWidget.couldNotLoadLocations')} {locationsError}
        </p>
      )}
    </form>
  )
}
