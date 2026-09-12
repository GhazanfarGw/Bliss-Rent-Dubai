import { useTranslation } from 'react-i18next'

interface RequirementItem {
  title: string
  body: string
}

/**
 * Dark "before you book" band — the real, already-enforced rental
 * requirements (18+ driver age matches the checkout validation in
 * DriverDetailsPage; airport pickup / city drop-off matches the
 * footer's coverage note — a UAE-wide business, live only in whichever
 * cities actually exist in `locations` today; see the Locations page for
 * the current list), not invented claims like a delivery service or a
 * specific supercar-only age minimum.
 */
export function RequirementsSection() {
  const { t } = useTranslation()
  const items = t('home.requirements.items', { returnObjects: true }) as RequirementItem[]

  return (
    <section className="bg-[#f1eee9]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-5xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand-gold">
            {t('home.requirements.eyebrow')}
          </p>
          <h2 className="mt-4 text-[clamp(2.8rem,5vw,6rem)] font-black leading-[0.92] tracking-[-0.065em] text-[#000] drop-shadow-[0_8px_24px_rgba(17,22,29,0.08)]">
            {t('home.requirements.title')}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#58616d]">
            {t('home.requirements.subtitle')}
          </p>
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={item.title}
              className="rounded-[1.75rem] border border-[#e7decf] bg-white/80 p-6 shadow-[0_18px_38px_rgba(17,22,29,0.06)] backdrop-blur-[2px]"
            >
              <div className="flex items-center justify-between">
                <RequirementIcon index={i} />
                <span className="font-mono text-xs font-semibold tracking-[0.18em] text-brand-gold">{`0${i + 1}`}</span>
              </div>
              <h3 className="mt-6 text-[1.6rem] font-semibold leading-tight tracking-[-0.04em] text-[#1b2430]">{item.title}</h3>
              <p className="mt-3 text-[1.02rem] leading-8 text-[#5e6874]">{item.body}</p>
              <div className="mt-6 h-px w-full bg-brand-gold" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function RequirementIcon({ index }: { index: number }) {
  const common = { className: 'h-6 w-6', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 } as const
  if (index === 0) {
    return (
      <svg viewBox="0 0 24 24" {...common} className="h-6 w-6 text-brand-gold" aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
        <path d="M3.5 9.5h17M8 3v3M16 3v3" strokeLinecap="round" />
      </svg>
    )
  }
  if (index === 1) {
    return (
      <svg viewBox="0 0 24 24" {...common} className="h-6 w-6 text-brand-gold" aria-hidden="true">
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <circle cx="8" cy="12" r="2" />
        <path d="M13 10h5M13 14h3" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" {...common} className="h-6 w-6 text-brand-gold" aria-hidden="true">
      <path d="M3 12h13M11 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 19h2.5a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 18.5 5H16" strokeLinecap="round" />
    </svg>
  )
}
