import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { storeLanguage, type SupportedLanguage } from '@/i18n'
import { UaeFlag } from '@/features/shared/UaeFlag'

interface LanguageSwitcherProps {
  className?: string
  /** 'light' reads on a dark/transparent background (e.g. NavBar overlaid on
   *  the homepage hero image); defaults to the original navy-on-light look
   *  used everywhere else. */
  tone?: 'dark' | 'light'
}

/**
 * Toggles between English and Arabic. The button label shows the OTHER
 * language's name (i.e. what you'll switch to), matching the convention
 * on most bilingual GCC sites.
 *
 * Offering Arabic shows the real UAE flag next to it — Arabic is this
 * business's actual home-market language, so that's an honest pairing.
 * Offering English shows a plain globe icon instead of a national flag:
 * English isn't any one country's language, and picking a flag (UK? US?)
 * to represent it would be an arbitrary, not-quite-honest choice the
 * same way an invented logo would be.
 */
export function LanguageSwitcher({ className = '', tone = 'dark' }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation()
  const offeringArabic = i18n.language !== 'ar'

  function toggle() {
    const next: SupportedLanguage = i18n.language === 'ar' ? 'en' : 'ar'
    void i18n.changeLanguage(next)
    storeLanguage(next)
  }

  const toneClass =
    tone === 'light'
      ? 'border-white/40 text-white hover:bg-white/10'
      : 'border-brand-navy/20 text-brand-navy hover:bg-brand-lavender'

  return (
    <button
      type="button"
      onClick={toggle}
      className={'flex items-center gap-1.5 rounded-none border px-3 py-1.5 text-sm font-semibold transition-colors ' + toneClass + (className ? ' ' + className : '')}
      aria-label={t('nav.switchLanguage')}
    >
      {offeringArabic ? <UaeFlag className="h-3.5 w-auto shrink-0" /> : <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {t('nav.language')}
    </button>
  )
}
