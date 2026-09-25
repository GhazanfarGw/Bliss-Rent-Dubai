import { useTranslation } from 'react-i18next'
import { LinkButton } from './LinkButton'

/**
 * The plain "ready to book?" band that closes the Home, About and Contact
 * pages: a small label, one serif heading and the two standard buttons, on
 * the page's own background — no box, border, shadow or tint. One component so
 * the three pages always look identical; each page only supplies its copy.
 */
export function ClosingCta({ eyebrow, heading }: { eyebrow: string; heading: string }) {
  const { t } = useTranslation()

  return (
    <section className="px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-brand-gold-dark">{eyebrow}</p>
        <h2 className="font-hero-serif mt-3 text-2xl font-semibold tracking-[-0.045em] text-brand-navy sm:text-3xl md:text-4xl">{heading}</h2>
        {/* Side by side even on a phone: each button takes half the row
            (flex-1), then goes back to its natural width from `sm` up. */}
        <div className="mt-5 flex justify-center gap-3 sm:mt-7">
          <LinkButton to="/search?mode=book" variant="primary" className="flex-1 sm:flex-none">
            {t('nav.searchCars')}
          </LinkButton>
          <LinkButton to="/search" variant="outline" className="flex-1 sm:flex-none">
            {t('hero.viewFleetCta')}
          </LinkButton>
        </div>
      </div>
    </section>
  )
}
