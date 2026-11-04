import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  PreferencesProvider,
  useColorSchemeName,
  usePreferences,
  useThemeColors,
} from '@/preferences/PreferencesProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <PreferencesProvider>
      <RootNavigator />
    </PreferencesProvider>
  );
}

function RootNavigator() {
  const { ready } = usePreferences();
  const scheme = useColorSchemeName();
  const colors = useThemeColors();
  const { t } = useTranslation();

  // Keep the splash screen until the saved theme and language are applied.
  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  const navigationTheme = useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [scheme, colors]);

  if (!ready) {
    return null;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerTintColor: colors.text }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
      </Stack>
    </ThemeProvider>
  );
}
