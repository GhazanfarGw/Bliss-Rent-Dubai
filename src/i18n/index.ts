import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/i18n/locales/en'
import ar from '@/i18n/locales/ar'

export const RTL_LANGUAGES = ['ar']
export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const STORAGE_KEY = 'dxb-language'

function readStoredLanguage(): SupportedLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'ar') return stored
  } catch {
    // localStorage can throw in some contexts (private browsing, disabled
    // storage) — fall back to the default language rather than crashing.
  }
  return 'en'
}

export function storeLanguage(language: SupportedLanguage) {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // best-effort only
  }
}

export function isRtl(language: string): boolean {
  return RTL_LANGUAGES.includes(language)
}

/** Applies <html dir/lang> for the given language — the single place that does this, called on init and on every language change. */
export function applyDocumentDirection(language: string) {
  document.documentElement.dir = isRtl(language) ? 'rtl' : 'ltr'
  document.documentElement.lang = language
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: readStoredLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  returnObjects: true,
})

applyDocumentDirection(i18n.language)
i18n.on('languageChanged', applyDocumentDirection)

export default i18n
