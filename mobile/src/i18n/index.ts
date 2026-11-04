import { createInstance, type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en';
import es from './locales/es';

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Used when the phone's language is neither Spanish nor English. */
export const FALLBACK_LANGUAGE: Language = 'en';

export type LanguagePreference = 'system' | Language;

export function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

/**
 * Language the app shows: the user's choice, or the phone's language when they chose "system".
 * `deviceLanguage` is an ISO 639 code such as "es" or "en" (from expo-localization).
 */
export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguage: string | null | undefined,
): Language {
  if (preference !== 'system') {
    return preference;
  }
  const code = deviceLanguage?.toLowerCase().split(/[-_]/)[0];
  return isLanguage(code) ? code : FALLBACK_LANGUAGE;
}

/** Creates an isolated i18next instance (one per app, or per test). */
export function createI18n(language: Language): i18n {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    resources: { en: { translation: en }, es: { translation: es } },
    lng: language,
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}
