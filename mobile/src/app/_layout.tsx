import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
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
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </PreferencesProvider>
  );
}

function RootNavigator() {
  const { ready } = usePreferences();
  const { status } = useAuth();
  const scheme = useColorSchemeName();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const loaded = ready && status !== 'loading';

  // Keep the splash screen until the saved theme, language and session are applied.
  useEffect(() => {
    if (loaded) {
      void SplashScreen.hideAsync();
    }
  }, [loaded]);

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

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerTintColor: colors.text }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
        <Stack.Screen name="sign-up" options={{ title: t('auth.signUp.title') }} />
        <Stack.Screen name="sign-in" options={{ title: t('auth.signIn.title') }} />
        <Stack.Screen name="check-email" options={{ title: t('auth.checkEmail.title') }} />
        <Stack.Screen name="forgot-password" options={{ title: t('auth.forgot.title') }} />
        <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
        <Stack.Screen name="edit-profile" options={{ title: t('profile.edit.title') }} />
        <Stack.Screen name="change-password" options={{ title: t('account.password.title') }} />
        <Stack.Screen name="delete-account" options={{ title: t('account.delete.label') }} />
      </Stack>
    </ThemeProvider>
  );
}
