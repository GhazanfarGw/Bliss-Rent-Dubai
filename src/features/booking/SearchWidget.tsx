import { useEffect, useState, type ComponentType, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CalendarDays, MapPinned } from 'lucide-react'
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
 * Return Location" checkbox. A new search shows both location fields so
 * the complete trip is explicit. Turning the checkbox on hides the return
 * field and reuses the pickup point for drop-off. The return picker searches
 * every UAE location directly, enabling a one-way rental.
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
   * on narrow screens; neither ever scrolls horizontally.
   * 'card': a sectioned, vertical layout (Pickup & Return grouped, then
   * Dates & Time, then a full-width submit) for BookCarPage — a
   * standalone page deserves a more editorial presentation than either
   * flat-row variant, without being a second implementation of anything.
   * All three variants share the exact same state, validation, and
   * `fetchLocations`/`onSearch` calls below — only the JSX layout differs.
   */
  layout?: 'grid' | 'row' | 'card' | 'navigator'
  /** 'card' layout only: drop the widget's own border, shadow and padding, for when it already sits inside a card or dialog. */
  chromeless?: boolean
  /** 'card' layout only: text of the submit button (default "Search Cars"), e.g. "Confirm & continue" in a booking popup. */
  submitLabel?: string
  /** 'card' layout only: shows the submit button as busy (and disabled) while the caller works on the result. */
  submitBusy?: boolean
}

export function SearchWidget({
  initialValues,
  onSearch,
  compact = false,
  layout = 'grid',
  chromeless = false,
  submitLabel,
  submitBusy = false,
}: SearchWidgetProps) {
  const { t } = useTranslation()
  const [locations, setLocations] = useState<Location[]>([])
  const [locationsError, setLocationsError] = useState<string | null>(null)
  const [locationsLoading, setLocationsLoading] = useState(true)

  const [startDate, setStartDate] = useState(initialValues?.startDate ?? '')
  const [endDate, setEndDate] = useState(initialValues?.endDate ?? '')
  const [pickupCity, setPickupCity] = useState(DEFAULT_CITY)
  const [pickupLocationId, setPickupLocationId] = useState(initialValues?.pickupLocationId ?? '')
  const [returnLocationId, setReturnLocationId] = useState(initialValues?.dropoffLocationId ?? '')
  // A new search defaults to separate pickup/return locations. Existing
  // criteria preserve a same-location trip when both stored ids match.
  const [sameReturnLocation, setSameReturnLocation] = useState(
    Boolean(
      initialValues?.pickupLocationId &&
        initialValues?.dropoffLocationId &&
        initialValues.dropoffLocationId === initialValues.pickupLocationId,
    ),
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

  if (layout === 'navigator') {
    return (
      <form onSubmit={handleSubmit} noValidate className="overflow-hidden border border-[#e4ded5] bg-white shadow-[0_18px_45px_rgba(7,10,26,0.07)]">
        <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-[#e4ded5] lg:rtl:divide-x-reverse">
          <section className="p-5 sm:p-6 lg:p-7">
            <SearchSectionHeading
              number="01"
              icon={MapPinned}
              title={t('searchWidget.sectionPickupReturn')}
              body={t('searchWidget.locationStepHint')}
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <CitySelect
                label={t('searchWidget.pickupCity')}
                ariaLabel={t('searchWidget.pickupCity')}
                value={pickupCity}
                onChange={handlePickupCityChange}
                cities={cities}
                disabled={locationsLoading || !!locationsError}
                fluid
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
                fluid
              />
            </div>

            <div className="mt-4">
              <SameReturnToggle checked={sameReturnLocation} onChange={setSameReturnLocation} />
            </div>

            {!sameReturnLocation && (
              <div className="mt-4">
                <LocationPickerButton
                  label={t('searchWidget.returnLocation')}
                  locationId={returnLocationId}
                  onLocationChange={setReturnLocationId}
                  options={uaeLocations}
                  loading={locationsLoading}
                  error={locationsError}
                  placeholder={t('searchWidget.selectReturnLocation')}
                  sheetTitle={t('searchWidget.chooseReturnLocation')}
                  fluid
                />
              </div>
            )}
          </section>

          <section className="border-t border-[#e4ded5] p-5 sm:p-6 lg:border-t-0 lg:p-7">
            <SearchSectionHeading
              number="02"
              icon={CalendarDays}
              title={t('searchWidget.sectionDatesTime')}
              body={t('searchWidget.dateStepHint')}
            />
            <div className="mt-5">
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={(next) => {
                  setStartDate(next.startDate)
                  setEndDate(next.endDate)
                }}
                todayIso={todayIso}
              />
            </div>
            <div className="mt-4 sm:max-w-52">
              <TimeSelect
                label={t('searchWidget.pickupTime')}
                ariaLabel={t('searchWidget.pickupTime')}
                value={pickupTime}
                onChange={setPickupTime}
                fluid
              />
            </div>
          </section>
        </div>

        {(touched || locationsError) && (
          <div className="border-t border-[#e4ded5] px-5 pt-4 sm:px-6 lg:px-7">
            {touched && dateValidation.error && (
              <p className="text-sm font-medium text-error">{t('errors.dateRange.' + dateValidation.error)}</p>
            )}
            {touched && !dateValidation.error && missingLocation && (
              <p className="text-sm font-medium text-error">{t('searchWidget.bothLocationsRequired')}</p>
            )}
            {locationsError && (
              <p className="text-sm font-medium text-error">
                {t('searchWidget.couldNotLoadLocations')} {locationsError}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4 border-t border-[#e4ded5] bg-surface-warm px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-7">
          <p className="max-w-xl text-xs leading-5 text-text-muted">{t('searchWidget.searchStepHint')}</p>
          <Button type="submit" fullWidthOnMobile className="group shrink-0 sm:px-7">
            {t('searchWidget.searchCars')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </div>
      </form>
    )
  }

  if (layout === 'card') {
    return (
      <form
        onSubmit={handleSubmit}
        noValidate
        className={'w-full space-y-8 ' + (chromeless ? '' : 'border border-[#ece7df] bg-white p-6 shadow-[0_20px_45px_rgba(15,18,22,0.08)] sm:p-8')}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-gold-dark">{t('searchWidget.sectionPickupReturn')}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CitySelect
              label={t('searchWidget.pickupCity')}
              ariaLabel={t('searchWidget.pickupCity')}
              value={pickupCity}
              onChange={handlePickupCityChange}
              cities={cities}
              disabled={locationsLoading || !!locationsError}
              fluid
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
              fluid
            />
          </div>

          <div className="mt-4">
            <SameReturnToggle checked={sameReturnLocation} onChange={setSameReturnLocation} />
          </div>

          {!sameReturnLocation && (
            <div className="mt-4">
              <LocationPickerButton
                label={t('searchWidget.returnLocation')}
                locationId={returnLocationId}
                onLocationChange={setReturnLocationId}
                options={uaeLocations}
                loading={locationsLoading}
                error={locationsError}
                placeholder={t('searchWidget.selectReturnLocation')}
                sheetTitle={t('searchWidget.chooseReturnLocation')}
                fluid
              />
            </div>
          )}
        </div>

        <div className="border-t border-[#ece7df] pt-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-gold-dark">{t('searchWidget.sectionDatesTime')}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(next) => {
                setStartDate(next.startDate)
                setEndDate(next.endDate)
              }}
              todayIso={todayIso}
            />
            <TimeSelect
              label={t('searchWidget.pickupTime')}
              ariaLabel={t('searchWidget.pickupTime')}
              value={pickupTime}
              onChange={setPickupTime}
              fluid
            />
          </div>
        </div>

        {touched && dateValidation.error && (
          <p className="text-sm font-medium text-error">{t('errors.dateRange.' + dateValidation.error)}</p>
        )}
        {touched && !dateValidation.error && missingLocation && (
          <p className="text-sm font-medium text-error">{t('searchWidget.bothLocationsRequired')}</p>
        )}
        {locationsError && (
          <p className="text-sm font-medium text-error">
            {t('searchWidget.couldNotLoadLocations')} {locationsError}
          </p>
        )}

        <Button type="submit" loading={submitBusy} fullWidthOnMobile className="w-full sm:w-auto sm:px-10">
          {submitLabel ?? t('searchWidget.searchCars')}
        </Button>
      </form>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={
        'w-full border border-[#dfe2de] bg-[#f7f7f5] shadow-[0_12px_30px_rgba(15,18,22,0.05)] ' +
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

      <div className={fieldRow ? 'mt-3' : 'mt-4'}>
        <SameReturnToggle checked={sameReturnLocation} onChange={setSameReturnLocation} compact />
      </div>

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

function SearchSectionHeading({
  number,
  icon: Icon,
  title,
  body,
}: {
  number: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  body: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-brand-navy text-white">
        <Icon className="h-4.5 w-4.5" aria-hidden={true} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-bold text-brand-navy">{title}</h4>
          <span className="text-[10px] font-semibold tracking-[0.18em] text-brand-gold-dark">{number}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-text-muted">{body}</p>
      </div>
    </div>
  )
}

function SameReturnToggle({ checked, onChange, compact = false }: { checked: boolean; onChange: (checked: boolean) => void; compact?: boolean }) {
  const { t } = useTranslation()

  return (
    <label className={'flex cursor-pointer items-center justify-between gap-4 border border-[#e4ded5] bg-surface-warm ' + (compact ? 'px-3 py-2' : 'px-4 py-3')}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-brand-navy">{t('searchWidget.sameReturnLocation')}</span>
        {!compact && <span className="mt-0.5 block text-xs leading-5 text-text-muted">{t('searchWidget.sameReturnHint')}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 bg-[#d8d4cd] transition-colors after:absolute after:start-1 after:top-1 after:h-4 after:w-4 after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-brand-gold peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-navy rtl:peer-checked:after:-translate-x-5"
      />
    </label>
  )
}
