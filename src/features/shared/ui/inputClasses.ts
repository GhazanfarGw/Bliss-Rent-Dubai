/** Shared base classes for every text-like input (TextField, SelectField,
 *  TextareaField, DateField, SearchField) — replacing the `inputClass`
 *  constant found independently declared 6 times across the app in the
 *  Phase 8 audit (SearchWidget, CustomerDetailsPage, DriverDetailsPage,
 *  ManageBookingPage, ExtendRentalSection, ContactPage). */
export function inputClass({ invalid = false }: { invalid?: boolean } = {}): string {
  return [
    'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-brand-navy outline-none transition-colors',
    'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted',
    invalid
      ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
      : 'border-border focus:border-brand-navy focus:ring-1 focus:ring-brand-navy',
  ].join(' ')
}
