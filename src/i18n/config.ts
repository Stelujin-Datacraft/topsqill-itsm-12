import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import de from '@/locales/de.json';
import ar from '@/locales/ar.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' as const },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', dir: 'ltr' as const },
  { code: 'fr', label: 'French', nativeLabel: 'Français', dir: 'ltr' as const },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', dir: 'ltr' as const },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' as const },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  ar: { translation: ar },
};

function applyDocumentLanguage(lng: string) {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === lng) ?? SUPPORTED_LANGUAGES[0];
  document.documentElement.lang = lang.code;
  document.documentElement.dir = lang.dir;
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'topsqill-language',
    },
  });

i18n.on('languageChanged', applyDocumentLanguage);
applyDocumentLanguage(i18n.language || 'en');

export default i18n;
