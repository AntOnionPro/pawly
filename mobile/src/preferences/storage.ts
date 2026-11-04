import AsyncStorage from '@react-native-async-storage/async-storage';

import { isLanguage, type LanguagePreference } from '@/i18n';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Preferences {
  theme: ThemePreference;
  language: LanguagePreference;
}

export const DEFAULT_PREFERENCES: Preferences = { theme: 'system', language: 'system' };

export const PREFERENCES_KEY = 'pawly:preferences';

const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

/** Keeps only valid values; anything unknown falls back to the default. */
export function parsePreferences(raw: string | null): Preferences {
  if (!raw) {
    return DEFAULT_PREFERENCES;
  }
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) {
      return DEFAULT_PREFERENCES;
    }
    const { theme, language } = data as Record<string, unknown>;
    return {
      theme: THEMES.includes(theme as ThemePreference)
        ? (theme as ThemePreference)
        : DEFAULT_PREFERENCES.theme,
      language:
        language === 'system' || isLanguage(language) ? language : DEFAULT_PREFERENCES.language,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function loadPreferences(): Promise<Preferences> {
  try {
    return parsePreferences(await AsyncStorage.getItem(PREFERENCES_KEY));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(preferences: Preferences): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Not saving a preference must never break the app; it is applied for this session anyway.
  }
}
