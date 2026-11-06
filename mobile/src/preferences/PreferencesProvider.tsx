import { useLocales } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { I18nextProvider } from 'react-i18next';
import { Appearance, Platform, useColorScheme, type TextStyle } from 'react-native';

import { createI18n, resolveLanguage, type LanguagePreference } from '@/i18n';
import {
  themeColors,
  type ColorSchemeName,
  type PaletteName,
  type ThemeColors,
} from '@/theme/colors';
import { fontFor, type FontPreference } from '@/theme/fonts';

import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type NearbyRadius,
  type Preferences,
  type ThemePreference,
} from './storage';

interface PreferencesContextValue extends Preferences {
  /** False until the saved preferences have been read. */
  ready: boolean;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: LanguagePreference) => void;
  setNearbyRadius: (radiusKm: NearbyRadius) => void;
  setFont: (font: FontPreference) => void;
  setPalette: (palette: PaletteName) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);
  const deviceLanguage = useLocales()[0]?.languageCode;
  const language = resolveLanguage(preferences.language, deviceLanguage);
  const [i18n] = useState(() => createI18n(language));

  useEffect(() => {
    let active = true;
    void loadPreferences().then((saved) => {
      if (active) {
        setPreferences(saved);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [i18n, language]);

  useEffect(() => {
    // Native views (tab bar, alerts, keyboard) follow the chosen theme too.
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(preferences.theme === 'system' ? 'auto' : preferences.theme);
    }
  }, [preferences.theme]);

  // Save only what the user changes, not the values just loaded.
  const changedByUser = useRef(false);
  useEffect(() => {
    if (changedByUser.current) {
      void savePreferences(preferences);
    }
  }, [preferences]);

  const update = useCallback((change: Partial<Preferences>) => {
    changedByUser.current = true;
    setPreferences((current) => ({ ...current, ...change }));
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ...preferences,
      ready,
      setTheme: (theme) => update({ theme }),
      setLanguage: (lang) => update({ language: lang }),
      setNearbyRadius: (radiusKm) => update({ nearbyRadiusKm: radiusKm }),
      setFont: (font) => update({ font }),
      setPalette: (palette) => update({ palette }),
    }),
    [preferences, ready, update],
  );

  return (
    <PreferencesContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used inside <PreferencesProvider>');
  }
  return context;
}

/** Light or dark, after applying the user's theme preference. */
export function useColorSchemeName(): ColorSchemeName {
  const { theme } = usePreferences();
  const system = useColorScheme();
  if (theme !== 'system') {
    return theme;
  }
  return system === 'dark' ? 'dark' : 'light';
}

export function useThemeColors(): ThemeColors {
  const scheme = useColorSchemeName();
  return themeColors(scheme, usePreferences().palette);
}

/** The style that sets the chosen font for a text of the given weight (see `fontFor`). */
export function useFontStyle(weight?: TextStyle['fontWeight']): TextStyle {
  return fontFor(usePreferences().font, weight);
}
