import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Car, CalendarSearch, CreditCard, IdCard } from 'lucide-react'
import { prefersReducedMotion } from '@/lib/motion'

interface Step {
  title: string
  body: string
}

/**
 * The real customer journey — choose dates/location, select a vehicle,
 * enter customer/driver details, complete booking/payment — all online.
 * Doubles as the header's "Services" anchor target.
 *
 * Roadmap-style timeline (per reference: a centered trunk line with small
 * pill labels branching off it, connected by short stub lines, each with
 * its own detail card) rather than a plain numbered list. Single
 * left-aligned column below `md` (trunk near the start edge, no room for
 * a second side); centered zigzag at `md`+, alternating which grid column
 * (and therefore which side of the trunk) each step's pill+card lands in
 * — `md:col-start-1`/`items-end` hugs its own end edge and `md:col-start-2`
 * /`items-start` hugs its own start edge, which is why no `rtl:` override
 * is needed there: a grid track's "end" is always adjacent to the next
 * track's "start" (where the trunk sits) regardless of direction. The
 * trunk itself, being truly centered via `-translate-x-1/2`, is the one
 * place that genuinely needs `rtl:translate-x-1/2` — logical `start-1/2`
 * lands on the same physical midpoint either way, but centering the box
 * on that point means shifting it in opposite physical directions.
 *
 * Each step reveals independently — its own IntersectionObserver entry —
 * exactly when it scrolls into view, rather than one fixed-timing sequence
 * fired for the whole section at once (a one-shot timer finishes before a
 * slow scroller ever sees the motion). `data-step-index` maps a fired
 * entry back to its step. Skips straight to fully revealed for
 * `prefers-reduced-motion`.
 */
const STEP_ICONS = [CalendarSearch, Car, IdCard, CreditCard]

export function HowItWorksSection() {
  const { t } = useTranslation()
  const steps = t('home.howItWorks.steps', { returnObjects: true }) as Step[]
  const reducedMotion = prefersReducedMotion()
  const listRef = useRef<HTMLOListElement>(null)
  const [revealed, setRevealed] = useState<Set<number>>(() =>
    reducedMotion ? new Set(steps.map((_, i) => i)) : new Set(),
  )

  useEffect(() => {
    if (reducedMotion) return
    const container = listRef.current
    if (!container) return

    const items = container.querySelectorAll<HTMLElement>('[data-step-index]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const index = Number(entry.target.getAttribute('data-step-index'))
          setRevealed((prev) => (prev.has(index) ? prev : new Set(prev).add(index)))
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.4 },
    )
    items.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [reducedMotion])

  return (
    <section id="how-it-works" className="scroll-mt-20 bg-surface-warm">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-hero-serif text-3xl font-semibold tracking-[-0.06em] text-brand-gold sm:text-4xl">{t('home.howItWorks.title')}</h2>
          <p className="mt-3 text-sm leading-6 text-black">{t('home.howItWorks.subtitle')}</p>
        </div>

        <ol ref={listRef} className="relative mx-auto mt-14 flex max-w-4xl flex-col gap-10 lg:mt-16 md:gap-14">
          {/* Static track behind the whole list, plus a fill line on top of
              it that grows from 0 to 100% height as steps get revealed. */}
          <div
            aria-hidden="true"
            className="absolute start-8 top-0 bottom-0 w-px bg-[#e4dfd8] md:start-1/2 md:-translate-x-1/2 md:rtl:translate-x-1/2"
          />
          <div
            aria-hidden="true"
            className="absolute start-8 top-0 w-px bg-gradient-to-b from-[#4a5360] to-brand-gold transition-[height] duration-700 ease-out md:start-1/2 md:-translate-x-1/2 md:rtl:translate-x-1/2"
            style={{ height: `${(revealed.size / steps.length) * 100}%` }}
          />

          {steps.map((step, i) => {
            const Icon = STEP_ICONS[i] ?? Car
            const isRevealed = revealed.has(i)
            const isRight = i % 2 === 1
            const numberBadge = (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-gold text-[10px] font-bold text-white">
                {i + 1}
              </span>
            )
            const pill = (
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold whitespace-nowrap text-brand-gold shadow-[0_8px_20px_rgba(11,19,43,0.12)] ring-1 ring-brand-text-brand-gold/10">
                {numberBadge}
                {step.title}
              </span>
            )
            const stub = (
              <span
                aria-hidden="true"
                className={
                  'h-px w-8 shrink-0 transition-colors duration-500 ' + (isRevealed ? 'bg-brand-gold/60' : 'bg-[#e4dfd8]')
                }
              />
            )
            const card = (
              <div className="flex w-full items-start gap-3 rounded-2xl bg-brand-text-brand-gold px-5 py-4 text-black shadow-[0_16px_32px_rgba(11,19,43,0.18)] md:max-w-sm">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold-light" aria-hidden="true" />
                <p className="text-sm leading-6 text-black/85">{step.body}</p>
              </div>
            )
            return (
              <li key={step.title} data-step-index={i} className="relative ps-12 md:grid md:grid-cols-2 md:ps-0">
                <div
                  className={
                    'flex flex-col gap-3 transition-all duration-500 ease-out ' +
                    (isRight ? 'md:col-start-2 md:items-start' : 'md:col-start-1 md:items-end') +
                    ' ' +
                    (isRevealed ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0')
                  }
                >
                  {/* Pill + stub, desktop only — mobile shows a plain heading instead. */}
                  <div className="hidden items-center md:flex">
                    {isRight ? (
                      <>
                        {stub}
                        {pill}
                      </>
                    ) : (
                      <>
                        {pill}
                        {stub}
                      </>
                    )}
                  </div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-gold md:hidden">
                    {numberBadge}
                    {step.title}
                  </h3>
                  {card}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
