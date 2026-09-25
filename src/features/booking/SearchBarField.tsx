import { forwardRef, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown } from 'lucide-react'
import { FieldPopover } from '@/features/shared/ui/FieldPopover'
import { BAR_LABEL, barTriggerClass, barValueClass } from '@/features/booking/searchBarStyles'

/**
 * Building blocks for the homepage search bar (SearchWidget `layout="row"`),
 * modelled on the Qatar Airways booking box: every field is a segment of one
 * bordered bar, with a small label above its value inside the segment, a
 * dark outline on the segment whose dropdown is open, and a white dropdown
 * panel (FieldPopover) directly under it.
 */

/** Segment trigger: small label on top, value (or grey placeholder) below, optional chevron. */
export const BarTrigger = forwardRef<
  HTMLButtonElement,
  {
    label: string
    value: ReactNode
    placeholder?: boolean
    open: boolean
    onClick: () => void
    disabled?: boolean
    chevron?: boolean
    haspopup?: 'listbox' | 'dialog'
    /** Keep digits left-to-right in Arabic (wraps the value in .ltr-nums). */
    numeric?: boolean
    /** Let a long value wrap to two lines on phones. */
    wrap?: boolean
  }
>(function BarTrigger({ label, value, placeholder = false, open, onClick, disabled = false, chevron = false, haspopup, numeric = false, wrap = false }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={open}
      aria-haspopup={haspopup}
      className={barTriggerClass(open)}
    >
      <span className="min-w-0 flex-1">
        <span className={BAR_LABEL}>{label}</span>
        <span className={barValueClass(placeholder, wrap)}>{numeric ? <span className="ltr-nums">{value}</span> : value}</span>
      </span>
      {chevron && (
        <ChevronDown className={'h-4 w-4 shrink-0 text-text-muted transition-transform ' + (open ? 'rotate-180' : '')} aria-hidden="true" />
      )}
    </button>
  )
})

interface BarSelectProps {
  label: string
  /** Dropdown heading on mobile, accessible name everywhere. */
  title: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  disabled?: boolean
  align?: 'start' | 'end'
  widthClassName?: string
  /** Segment wrapper classes (width, dividers) from the bar layout. */
  className?: string
  /** Keep digits left-to-right in Arabic (times). */
  numeric?: boolean
}

/**
 * A custom dropdown replacing a native <select> inside the bar (native
 * selects open the OS menu, which can't match the rest of the bar): a
 * trigger segment plus a list of options, the current one ticked.
 */
export function BarSelect({ label, title, value, options, onChange, disabled = false, align = 'start', widthClassName = 'w-64', className = '', numeric = false }: BarSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  return (
    <div ref={anchorRef} className={'relative ' + className}>
      <BarTrigger
        label={label}
        value={current?.label ?? value}
        open={open}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        chevron
        haspopup="listbox"
        numeric={numeric}
      />
      <FieldPopover open={open} onClose={() => setOpen(false)} title={title} closeLabel={t('common.close')} anchorRef={anchorRef} align={align} widthClassName={widthClassName} sheetMaxWidthClassName="max-w-md">
        {/* Desktop: a short scrolling list in the panel. Phone sheet: the sheet body scrolls, rows get Qatar's dividers. */}
        <ul role="listbox" aria-label={title} className="lg:max-h-72 lg:overflow-y-auto lg:p-2">
          {options.map((opt) => {
            const selected = opt.value === value
            return (
              <li key={opt.value} className="border-b border-[#efece7] last:border-b-0 lg:border-b-0">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-option
                  data-selected={selected || undefined}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={
                    'my-0.5 flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start text-[0.9375rem] lg:my-0 lg:min-h-11 lg:text-sm outline-none transition-colors hover:bg-brand-lavender focus-visible:bg-brand-lavender focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-navy ' +
                    (selected ? 'font-semibold text-brand-gold' : 'text-brand-navy')
                  }
                >
                  {numeric ? <span className="ltr-nums">{opt.label}</span> : opt.label}
                  {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      </FieldPopover>
    </div>
  )
}
