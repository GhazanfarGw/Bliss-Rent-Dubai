import { useTranslation } from 'react-i18next'
import { storeLanguage, type SupportedLanguage } from '@/i18n'
import { UaeFlag } from '@/features/shared/UaeFlag'
import { UkFlag } from '@/features/shared/UkFlag'

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
 * on most bilingual GCC sites. Offering Arabic shows the real UAE flag;
 * offering English shows the UK flag — the common convention on
 * bilingual Gulf-region sites, alongside the language-switcher's own
 * name label so it never stands in as an unexplained country claim.
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
      className={'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ' + toneClass + (className ? ' ' + className : '')}
      aria-label={t('nav.switchLanguage')}
    >
      {offeringArabic ? <UaeFlag className="h-3.5 w-auto shrink-0" /> : <UkFlag className="h-3.5 w-auto shrink-0" />}
      {t('nav.language')}
    </button>
  )
}
