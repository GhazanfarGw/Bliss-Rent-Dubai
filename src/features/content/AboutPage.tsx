import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface ValueItem {
  title: string
  body: string
}

/**
 * About Us — its own page (not the home-page anchor). Story, Vision,
 * Mission, and Values, all real business facts (no invented awards or
 * stats), matching the tone already established in WhyChooseSection.
 */
export function AboutPage() {
  const { t } = useTranslation()
  const storyParagraphs = t('pages.about.story.paragraphs', { returnObjects: true }) as string[]
  const values = t('pages.about.values.items', { returnObjects: true }) as ValueItem[]

  return (
    <div>
      <div className="bg-brand-navy">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{t('pages.about.title')}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-brand-lavender sm:text-base">{t('pages.about.subtitle')}</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <section>
          <h2 className="text-xl font-bold text-brand-navy">{t('pages.about.story.heading')}</h2>
          <div className="mt-3 space-y-3">
            {storyParagraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-brand-navy/80">
                {p}
              </p>
            ))}
          </div>
        </section>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-brand-navy/10 bg-brand-lavender/30 p-6">
            <h2 className="text-base font-semibold text-brand-navy">{t('pages.about.vision.heading')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-navy/80">{t('pages.about.vision.body')}</p>
          </div>
          <div className="rounded-2xl border border-brand-navy/10 bg-brand-lavender/30 p-6">
            <h2 className="text-base font-semibold text-brand-navy">{t('pages.about.mission.heading')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-navy/80">{t('pages.about.mission.body')}</p>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-brand-navy">{t('pages.about.values.heading')}</h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {values.map((item, i) => (
              <div key={item.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-navy text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-brand-navy">{item.title}</h3>
                  <p className="mt-1 text-sm text-text-muted">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 flex justify-center">
          <Link
            to="/search"
            className="rounded-lg bg-brand-gold px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-gold-light"
          >
            {t('nav.searchCars')}
          </Link>
        </div>
      </div>
    </div>
  )
}
