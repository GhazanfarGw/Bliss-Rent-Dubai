/**
 * Shared class names for the homepage search bar (SearchWidget
 * `layout="row"`) — kept out of SearchBarField.tsx so that file only
 * exports components (React fast refresh).
 */

/** Border colour shared by the bar, its mobile groups and the dividers. */
export const BAR_BORDER = 'border-[#d9d6d0]'

/** Segment-trigger look (also used by the calendar's two-part trigger in DateRangePicker). */
export function barTriggerClass(open: boolean): string {
  return (
    'relative flex h-full min-h-15 w-full items-center gap-3 rounded-lg px-4 py-2.5 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-navy disabled:cursor-not-allowed disabled:opacity-60 ' +
    (open ? 'z-10 bg-white ring-2 ring-brand-navy' : 'hover:bg-brand-lavender')
  )
}

/** Small grey label / value pair inside a segment. */
export const BAR_LABEL = 'block text-xs text-text-muted'
/** `wrap`: allow two lines on phones (long location names), one line from lg. */
export function barValueClass(placeholder: boolean, wrap = false): string {
  return (
    'mt-0.5 block text-[0.9375rem] ' +
    (wrap ? 'line-clamp-2 lg:line-clamp-1 ' : 'truncate ') +
    (placeholder ? 'text-text-muted' : 'font-medium text-brand-navy')
  )
}
