import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createQueryClient } from '@/api/queryClient';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { usePushRegistration, usePushTaps } from '@/features/push/hooks';
import {
  PreferencesProvider,
  useColorSchemeName,
  usePreferences,
  useThemeColors,
} from '@/preferences/PreferencesProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  return (
    <PreferencesProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
        </QueryClientProvider>
      </AuthProvider>
    </PreferencesProvider>
  );
}

/** Keeps this phone registered for push and opens what a tapped push is about. */
function PushHandlers() {
  usePushRegistration();
  usePushTaps();
  return null;
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
        <Stack.Screen name="search" options={{ title: t('search.title') }} />
        <Stack.Screen name="report" options={{ title: t('report.title') }} />
        <Stack.Screen name="blocked" options={{ title: t('blocks.title') }} />
        <Stack.Screen name="notifications" options={{ title: t('notifications.title') }} />
        <Stack.Screen name="notification-settings" options={{ title: t('pushSettings.title') }} />
        <Stack.Screen name="messages/index" options={{ title: t('messages.title') }} />
        <Stack.Screen name="messages/[id]" options={{ title: '' }} />
        <Stack.Screen name="sign-up" options={{ title: t('auth.signUp.title') }} />
        <Stack.Screen name="sign-in" options={{ title: t('auth.signIn.title') }} />
        <Stack.Screen name="check-email" options={{ title: t('auth.checkEmail.title') }} />
        <Stack.Screen name="forgot-password" options={{ title: t('auth.forgot.title') }} />
        <Stack.Screen name="legal/[doc]" options={{ title: '' }} />
        <Stack.Screen name="edit-profile" options={{ title: t('profile.edit.title') }} />
        <Stack.Screen name="change-password" options={{ title: t('account.password.title') }} />
        <Stack.Screen name="delete-account" options={{ title: t('account.delete.label') }} />
        <Stack.Screen name="pet/new" options={{ title: t('pets.new') }} />
        <Stack.Screen name="pet/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="pet/[id]/edit" options={{ title: t('pets.edit') }} />
        <Stack.Screen name="adoption/new" options={{ title: t('adoption.give') }} />
        <Stack.Screen name="adoption/[id]/index" options={{ title: t('adoption.detailTitle') }} />
        <Stack.Screen name="adoption/[id]/edit" options={{ title: t('adoption.edit') }} />
        <Stack.Screen
          name="adoption/[id]/request"
          options={{ title: t('adoptionRequests.title') }}
        />
        <Stack.Screen
          name="adoption/[id]/requests"
          options={{ title: t('adoptionRequests.listTitle') }}
        />
        <Stack.Screen
          name="adoption/requests"
          options={{ title: t('adoptionRequests.sentTitle') }}
        />
        <Stack.Screen
          name="adoption/[id]/complete"
          options={{ title: t('adoption.markAdopted') }}
        />
        <Stack.Screen name="rescue/new" options={{ title: t('rescue.newTitle') }} />
        <Stack.Screen name="rescue/[id]/index" options={{ title: t('rescue.detailTitle') }} />
        <Stack.Screen name="rescue/[id]/edit" options={{ title: t('rescue.edit') }} />
        <Stack.Screen name="post/[id]/index" options={{ title: t('posts.title') }} />
        <Stack.Screen name="post/[id]/edit" options={{ title: t('posts.edit') }} />
        <Stack.Screen name="post/[id]/repost" options={{ title: t('reposts.title') }} />
        <Stack.Screen name="post/[id]/send" options={{ title: t('share.title') }} />
        <Stack.Screen name="user/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="user/[id]/followers" options={{ title: t('follows.followersTitle') }} />
        <Stack.Screen name="user/[id]/following" options={{ title: t('follows.followingTitle') }} />
      </Stack>
      <PushHandlers />
    </ThemeProvider>
  );
}
