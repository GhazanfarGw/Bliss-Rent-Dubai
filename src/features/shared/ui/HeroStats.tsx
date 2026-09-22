export interface HeroStat {
  value: number | string
  label: string
}

/**
 * The glass "live numbers" strip that sits under the homepage hero's
 * buttons: one joined, bordered strip. (The About page's hero has no such
 * strip — its live numbers are in the "at a glance" profile further down.)
 * Cells divide the strip equally whatever their count, and use logical
 * borders (`border-e`) so the dividers mirror in RTL. The numbers are
 * always real, passed in from live data by the caller — this component
 * only draws them.
 */
export function HeroStats({ items, className = '' }: { items: HeroStat[]; className?: string }) {
  return (
    <div className={'grid auto-cols-fr grid-flow-col border-y border-white/20 bg-brand-navy/30 backdrop-blur-sm ' + className}>
      {items.map((item) => (
        <div key={item.label} className="border-e border-white/20 px-3 py-4 last:border-e-0 sm:px-6">
          <p className="font-hero-serif text-2xl font-semibold lining-nums text-white sm:text-3xl">{item.value}</p>
          <p className="mt-1 text-[10px] font-medium uppercase leading-4 tracking-[0.12em] text-white/65 sm:text-xs">{item.label}</p>
        </div>
      ))}
    </div>
  )
}
