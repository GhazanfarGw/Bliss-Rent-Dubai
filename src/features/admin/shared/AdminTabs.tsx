export interface AdminTab<T extends string> {
  value: T
  label: string
  count?: number
}

interface AdminTabsProps<T extends string> {
  tabs: AdminTab<T>[]
  active: T
  onChange: (value: T) => void
}

export function AdminTabs<T extends string>({ tabs, active, onChange }: AdminTabsProps<T>) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-brand-navy/10">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={
            '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ' +
            (active === tab.value
              ? 'border-brand-gold text-brand-navy'
              : 'border-transparent text-text-muted hover:text-brand-navy')
          }
        >
          {tab.label}
          {typeof tab.count === 'number' && (
            <span
              className={
                'rounded-full px-1.5 py-0.5 text-[11px] font-semibold ' +
                (active === tab.value ? 'bg-brand-lavender text-brand-navy' : 'bg-surface-muted text-text-muted')
              }
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
