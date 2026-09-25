import { useEffect, useState, type ComponentType, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CalendarDays, MapPinned } from 'lucide-react'
import { fetchLocations } from '@/features/booking/api'
import { validateDateRange } from '@/lib/dateRange'
import { DEFAULT_TIME, TIME_OPTIONS, formatTimeLabel } from '@/lib/timeOptions'
import { Button } from '@/features/shared/ui/Button'
import { DateRangePicker } from '@/features/booking/DateRangePicker'
import { CitySelect, LocationPickerButton } from '@/features/booking/LocationField'
import { BarSelect } from '@/features/booking/SearchBarField'
import { BAR_BORDER } from '@/features/booking/searchBarStyles'
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
   * 'grid' (default): a plain flat row of fields that wraps on narrow screens.
   * 'row': the homepage search bar, modelled on the Qatar Airways booking
   * box — one bordered bar of labelled segments (stacked into grouped boxes
   * below lg), dropdown panels under each field (FieldPopover), a checkbox
   * for "same return location" and a pill Search button. Also guides the
   * visitor: finishing one field opens the next.
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
  const { t, i18n } = useTranslation()
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
  // Guided auto-advance for `layout="row"` (the homepage/sticky-bar
  // navigator) only: at most one field sheet is open at a time, and
  // finishing one automatically opens the next, so the visitor doesn't
  // have to tap each trigger in turn. Every other layout leaves this
  // unset and each field keeps managing its own open state independently.
  const [activeStep, setActiveStep] = useState<'pickupLocation' | 'returnLocation' | 'dates' | null>(null)
  const guided = layout === 'row' || layout === 'card'

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
    // Guided flow: choosing a city immediately opens Pickup Location next.
    if (guided) setActiveStep('pickupLocation')
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

  // Qatar-style fields shared by the homepage bar (`row`) and the booking
  // popups (`card`); each layout only decides where they sit. Choosing a
  // value opens the next field (guided flow).
  const cityField = (className: string) => (
    <BarSelect
      label={t('searchWidget.pickupCity')}
      title={t('searchWidget.chooseCity')}
      value={pickupCity}
      options={cities.map((c) => ({ value: c, label: c }))}
      onChange={handlePickupCityChange}
      disabled={locationsLoading || !!locationsError}
      widthClassName="w-56"
      className={className}
    />
  )
  const pickupField = (className: string) => (
    <LocationPickerButton
      bar
      className={className}
      label={t('searchWidget.pickupLocation')}
      locationId={pickupLocationId}
      onLocationChange={(id) => {
        setPickupLocationId(id)
        setActiveStep(sameReturnLocation ? 'dates' : 'returnLocation')
      }}
      options={pickupCityLocations}
      loading={locationsLoading}
      error={locationsError}
      placeholder={t('searchWidget.selectPickup')}
      sheetTitle={t('searchWidget.choosePickupLocation')}
      open={activeStep === 'pickupLocation'}
      onOpenChange={(next) => setActiveStep((prev) => (next ? 'pickupLocation' : prev === 'pickupLocation' ? null : prev))}
    />
  )
  const returnField = (className: string) =>
    sameReturnLocation ? null : (
      <LocationPickerButton
        bar
        className={className}
        label={t('searchWidget.returnLocation')}
        locationId={returnLocationId}
        onLocationChange={(id) => {
          setReturnLocationId(id)
          setActiveStep('dates')
        }}
        options={uaeLocations}
        loading={locationsLoading}
        error={locationsError}
        placeholder={t('searchWidget.selectReturnLocation')}
        sheetTitle={t('searchWidget.chooseReturnLocation')}
        open={activeStep === 'returnLocation'}
        onOpenChange={(next) => setActiveStep((prev) => (next ? 'returnLocation' : prev === 'returnLocation' ? null : prev))}
      />
    )
  const datesField = (className: string) => (
    <DateRangePicker
      bar
      className={className}
      startDate={startDate}
      endDate={endDate}
      onChange={(next) => {
        setStartDate(next.startDate)
        setEndDate(next.endDate)
      }}
      todayIso={todayIso}
      open={activeStep === 'dates'}
      onOpenChange={(next) => setActiveStep((prev) => (next ? 'dates' : prev === 'dates' ? null : prev))}
      closeOnComplete
    />
  )
  const timeField = (className: string) => (
    <BarSelect
      label={t('searchWidget.pickupTime')}
      title={t('searchWidget.pickupTime')}
      value={pickupTime}
      options={TIME_OPTIONS.map((v) => ({ value: v, label: formatTimeLabel(v, i18n.language) }))}
      onChange={setPickupTime}
      align="end"
      widthClassName="w-52"
      className={className}
      numeric
    />
  )
  const sameReturnCheckbox = (
    <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-brand-navy">
      <input
        type="checkbox"
        checked={sameReturnLocation}
        onChange={(e) => {
          setSameReturnLocation(e.target.checked)
          if (e.target.checked && activeStep === 'returnLocation') setActiveStep('dates')
        }}
        className="h-5 w-5 shrink-0 cursor-pointer accent-brand-gold"
      />
      {t('searchWidget.sameReturnLocation')}
    </label>
  )
  const formErrors = (
    <>
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
    </>
  )

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
    // The booking popups (fleet "Add your dates", vehicle "Book now"): the
    // same Qatar-style fields as the homepage bar, grouped into rounded
    // boxes — locations, then dates + time — with the "same return"
    // checkbox and a pill submit button.
    const box = 'rounded-lg border ' + BAR_BORDER
    const eyebrow = 'text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-gold-dark'
    return (
      <form
        onSubmit={handleSubmit}
        noValidate
        className={'w-full ' + (chromeless ? '' : 'rounded-2xl bg-white p-6 shadow-(--shadow-card) sm:p-8')}
      >
        <p className={eyebrow}>{t('searchWidget.sectionPickupReturn')}</p>
        <div className={'mt-3 grid sm:grid-cols-[11rem_minmax(0,1fr)] ' + box}>
          {cityField('')}
          {pickupField('border-t border-[#e6e3de] sm:border-s sm:border-t-0')}
          {returnField('border-t border-[#e6e3de] sm:col-span-2')}
        </div>
        <div className="mt-3">{sameReturnCheckbox}</div>

        <p className={eyebrow + ' mt-7'}>{t('searchWidget.sectionDatesTime')}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className={box}>{datesField('')}</div>
          <div className={box}>{timeField('')}</div>
        </div>

        {formErrors}

        <div className="mt-7 flex sm:justify-end">
          <Button type="submit" loading={submitBusy} fullWidthOnMobile className="min-h-12 w-full sm:w-auto sm:px-12">
            {submitLabel ?? t('searchWidget.searchCars')}
          </Button>
        </div>
      </form>
    )
  }

  if (layout === 'row') {
    // Qatar-Airways-style search bar (homepage). Desktop: every field is a
    // segment of ONE bordered bar, split by short dividers. Below lg the
    // same segments stack into three rounded boxes (locations / dates /
    // time), like Qatar's mobile form. The three group wrappers turn into
    // `display: contents` at lg so their segments join the single bar.
    const group = 'flex flex-col rounded-lg border lg:contents ' + BAR_BORDER
    const divider = 'lg:before:absolute lg:before:inset-y-3 lg:before:start-0 lg:before:w-px lg:before:bg-[#e6e3de]'
    const stacked = 'border-t border-[#e6e3de] lg:border-t-0 ' + divider

    return (
      <form onSubmit={handleSubmit} noValidate className="w-full">
        <div className={'flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0 lg:rounded-lg lg:border ' + BAR_BORDER}>
          <div className={group}>
            {cityField('lg:w-40 lg:shrink-0')}
            {pickupField(stacked + ' lg:min-w-0 lg:flex-1')}
            {returnField(stacked + ' lg:min-w-0 lg:flex-1')}
          </div>

          <div className={group}>{datesField(divider + ' lg:w-[17rem] lg:shrink-0')}</div>

          <div className={group}>{timeField(divider + ' lg:w-40 lg:shrink-0')}</div>
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {sameReturnCheckbox}
          <button
            type="submit"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand-gold px-12 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-brand-gold-dark focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-brand-navy sm:w-auto"
          >
            {t('searchWidget.searchCars')}
          </button>
        </div>

        {formErrors}
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
      <div className="flex flex-wrap items-end gap-3">
        <CitySelect
          label={t('searchWidget.pickupCity')}
          ariaLabel={t('searchWidget.pickupCity')}
          value={pickupCity}
          onChange={handlePickupCityChange}
          cities={cities}
          disabled={locationsLoading || !!locationsError}
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
          />
        )}

        <div className="w-full sm:w-64">
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
        />

        <Button type="submit">{t('searchWidget.searchCars')}</Button>
      </div>

      <div className="mt-4">
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
