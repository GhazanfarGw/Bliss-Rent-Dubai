import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import logoMark from '@/assets/brand/logo-full.png'
import { PAYMENT_LOGOS } from '@/lib/paymentLogos'
import { BLOG_POSTS, postCopy, postPath } from '@/features/blog/blogPosts'
import { CITY_GUIDES } from '@/features/content/cityGuides'

/** How many recent articles the footer's Guides column lists. */
const FOOTER_GUIDE_COUNT = 4

/**
 * Social links are placeholder "#" hrefs until real handles exist — swap
 * the href on each icon once the business's actual social accounts are
 * set up.
 */
const SOCIAL_LINKS = [
  { name: 'Facebook', href: '#', icon: FacebookIcon },
  { name: 'Instagram', href: '#', icon: InstagramIcon },
  { name: 'X (Twitter)', href: '#', icon: XIcon },
]

export function Footer() {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language === 'ar'

  return (
    // White panel with large rounded top corners on the grey page, like the
    // Qatar Airways footer. The maroon pattern strip on top stays.
    <footer className="overflow-hidden rounded-t-[2rem] bg-white text-[#1f2430]">
      <img className='w-full mx-auto justify-center' src='/footerbaner.jpg' alt="Footer Logo" />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <div className="flex items-center gap-2">
              <img src={logoMark} alt="Bliss Rent Dubai" className="h-8 w-auto" />
            </div>
            <p className="mt-3 max-w-xs text-sm leading-6 text-text-muted">{t('footer.tagline')}</p>

            <div className="mt-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-brand-gold-dark">{t('footer.followUs')}</h3>
              <div className="mt-2 flex gap-3">
                {SOCIAL_LINKS.map(({ name, href, icon: Icon }) => (
                  <a
                    key={name}
                    href={href}
                    aria-label={name}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e5dfd6] bg-white text-[#1f2430] transition-colors hover:border-brand-gold/40 hover:bg-brand-gold/10 hover:text-brand-navy"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-brand-gold-dark">{t('footer.company')}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/about" className="text-text-muted transition-colors hover:text-brand-navy">
                  {t('footer.aboutUs')}
                </Link>
              </li>
              <li>
                {/* Moved here from the header nav (NavBar.tsx) to declutter it —
                    still the same in-page anchor to the homepage's "How It Works"
                    section, not a new destination. */}
                <Link to={{ pathname: '/', hash: '#how-it-works' }} className="text-text-muted transition-colors hover:text-brand-navy">
                  {t('nav.services')}
                </Link>
              </li>
              <li>
                <Link to="/car-types" className="text-text-muted transition-colors hover:text-brand-navy">
                  {t('footer.carTypes')}
                </Link>
              </li>
              <li>
                <Link to="/locations" className="text-text-muted transition-colors hover:text-brand-navy">
                  {t('footer.locations')}
                </Link>
              </li>
              <li>
                <Link to="/search" className="text-text-muted transition-colors hover:text-brand-navy">
                  {t('nav.browseFleet')}
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-text-muted transition-colors hover:text-brand-navy">
                  {t('footer.blog')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-text-muted transition-colors hover:text-brand-navy">
                  {t('footer.contactUs')}
                </Link>
              </li>
              <li>
                <Link to="/faqs" className="text-text-muted transition-colors hover:text-brand-navy">
                  {t('footer.faqs')}
                </Link>
              </li>

            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-brand-gold-dark">{t('footer.rentByCity')}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {CITY_GUIDES.map((guide) => (
                <li key={guide.slug}>
                  <Link to={`/locations/${guide.slug}`} className="text-text-muted transition-colors hover:text-brand-navy">
                    {isArabic ? guide.ar.name : guide.en.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-brand-gold-dark">{t('footer.guides')}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {BLOG_POSTS.slice(0, FOOTER_GUIDE_COUNT).map((post) => (
                <li key={post.slug}>
                  <Link to={postPath(post.slug)} className="text-text-muted transition-colors hover:text-brand-navy">
                    {postCopy(post, i18n.language).title}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/blog" className="font-semibold text-brand-gold-dark transition-colors hover:text-brand-navy">
                  {t('footer.allArticles')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-brand-gold-dark">{t('footer.legal')}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/privacy-policy" className="text-text-muted transition-colors hover:text-brand-navy">
                  {t('footer.privacyPolicy')}
                </Link>
              </li>
              <li>
                <Link to="/cookie-policy" className="text-text-muted transition-colors hover:text-brand-navy">
                  {t('footer.cookiePolicy')}
                </Link>
              </li>
              <li>
                <Link to="/booking-terms" className="text-text-muted transition-colors hover:text-brand-navy">
                  {t('footer.bookingTerms')}
                </Link>
              </li>
            </ul>

            <h3 className="mt-8 text-sm font-semibold text-brand-gold-dark">{t('footer.goodToKnow')}</h3>
            <ul className="mt-3 space-y-2 text-sm text-text-muted">
              <li>{t('footer.knowDubaiOnly')}</li>
              <li>{t('footer.knowWebsiteOnly')}</li>
              <li>{t('footer.knowOwnDriver')}</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-text-muted">
            © {new Date().getFullYear()} {t('footer.copyright')}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">{t('footer.weAccept')}</span>
            <div className="flex gap-2">
              {PAYMENT_LOGOS.map((logo) => (
                <span
                  key={logo.name}
                  className="flex h-9 w-13 items-center justify-center rounded-md border border-[#e5dfd6] bg-white"
                >
                  <svg viewBox="0 0 24 24" role="img" aria-label={logo.name} className="h-5.5 w-5.5">
                    <path d={logo.path} fill={`#${logo.hex}`} />
                  </svg>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7C16.4 3.66 15.4 3.57 14.24 3.57c-2.4 0-4.05 1.47-4.05 4.16V9.9H7.48V13h2.71v8h3.31Z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.24 3H21l-6.3 7.2L22 21h-6.15l-4.82-6.3L5.5 21H2.7l6.74-7.7L2 3h6.3l4.36 5.77L18.24 3Zm-1.08 16.2h1.51L7.98 4.7H6.36l10.8 14.5Z" />
    </svg>
  )
}
