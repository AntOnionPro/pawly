import AsyncStorage from '@react-native-async-storage/async-storage';

import { isLanguage, type LanguagePreference } from '@/i18n';
import { PALETTE_NAMES, type PaletteName } from '@/theme/colors';
import { FONT_PREFERENCES, type FontPreference } from '@/theme/fonts';

export type ThemePreference = 'system' | 'light' | 'dark';

/** How far (in km) rescue cases count as nearby. */
export const NEARBY_RADII = [1, 5, 10, 25] as const;
export type NearbyRadius = (typeof NEARBY_RADII)[number];

export interface Preferences {
  theme: ThemePreference;
  language: LanguagePreference;
  nearbyRadiusKm: NearbyRadius;
  font: FontPreference;
  /** Palette of the light theme. */
  palette: PaletteName;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  language: 'system',
  nearbyRadiusKm: 5,
  font: 'ubuntu',
  palette: 'pink',
};

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
    const { theme, language, nearbyRadiusKm, font, palette } = data as Record<string, unknown>;
    return {
      theme: THEMES.includes(theme as ThemePreference)
        ? (theme as ThemePreference)
        : DEFAULT_PREFERENCES.theme,
      language:
        language === 'system' || isLanguage(language) ? language : DEFAULT_PREFERENCES.language,
      nearbyRadiusKm: NEARBY_RADII.includes(nearbyRadiusKm as NearbyRadius)
        ? (nearbyRadiusKm as NearbyRadius)
        : DEFAULT_PREFERENCES.nearbyRadiusKm,
      font: FONT_PREFERENCES.includes(font as FontPreference)
        ? (font as FontPreference)
        : DEFAULT_PREFERENCES.font,
      palette: PALETTE_NAMES.includes(palette as PaletteName)
        ? (palette as PaletteName)
        : DEFAULT_PREFERENCES.palette,
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
