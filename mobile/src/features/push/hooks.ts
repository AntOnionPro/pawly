import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';

import {
  getPushPrefs,
  savePushPrefs,
  savePushToken,
  type PushLanguage,
  type PushPlatform,
  type SavedPushPrefs,
} from './api';
import { getPushPermission, getPushToken, listenToPushTaps, type PushTarget } from './device';

/** Set once the app asked for the notification permission, so it asks only once. */
export const PUSH_ASKED_KEY = 'pawly:pushAsked';

function usePushSaver() {
  const { client, user } = useAuth();
  const { i18n } = useTranslation();
  return async (ask: boolean) => {
    if (!user) return;
    try {
      const token = await getPushToken({ ask });
      if (!token) return;
      const language: PushLanguage = i18n.language.startsWith('es') ? 'es' : 'en';
      await savePushToken(client, user.id, token, Platform.OS as PushPlatform, language);
    } catch {
      // Push is a bonus: the app works the same without it.
    }
  };
}

export const pushKeys = {
  prefs: (userId: string) => ['pushPrefs', userId] as const,
  permission: ['pushPermission'] as const,
};

/** The user's push preferences (all on until they change something). */
export function usePushPrefs() {
  const { client, user, status } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: pushKeys.prefs(userId),
    queryFn: () => getPushPrefs(client, userId),
    enabled: status === 'signedIn' && Boolean(userId),
  });
}

/** Saves the preferences, showing the change at once and undoing it if it fails. */
export function useSavePushPrefs() {
  const { client, user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const key = pushKeys.prefs(userId);
  return useMutation({
    mutationFn: (saved: SavedPushPrefs) => savePushPrefs(client, userId, saved),
    onMutate: async (saved) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SavedPushPrefs>(key);
      queryClient.setQueryData(key, saved);
      return { previous };
    },
    onError: (_error, _saved, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (id, saved) => {
      queryClient.setQueryData(key, { ...saved, id });
    },
  });
}

/** Whether this phone shows push; checked again when the user comes back from Settings. */
export function usePushPermission() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void queryClient.invalidateQueries({ queryKey: pushKeys.permission });
    });
    return () => subscription.remove();
  }, [queryClient]);
  return useQuery({ queryKey: pushKeys.permission, queryFn: getPushPermission });
}

/** Asks for the notification permission now (a button in Settings) and saves the token. */
export function useEnablePush() {
  const queryClient = useQueryClient();
  const save = usePushSaver();
  return async () => {
    await AsyncStorage.setItem(PUSH_ASKED_KEY, 'true');
    await save(true);
    await queryClient.invalidateQueries({ queryKey: pushKeys.permission });
  };
}

/**
 * Keeps this phone's token on the server while signed in (and its language up to date),
 * without asking for permission.
 */
export function usePushRegistration() {
  const { status, user } = useAuth();
  const { i18n } = useTranslation();
  const save = usePushSaver();
  const userId = user?.id;
  const register = useEffectEvent(() => {
    void save(false);
  });
  useEffect(() => {
    if (status === 'signedIn' && userId) register();
  }, [status, userId, i18n.language]);
}

/**
 * Asks for the notification permission the first time a screen where it makes sense opens
 * (messages, notifications), and saves the token if allowed.
 */
export function useAskForPushOnce() {
  const { status } = useAuth();
  const save = usePushSaver();
  const ask = useEffectEvent(async () => {
    if ((await AsyncStorage.getItem(PUSH_ASKED_KEY)) === 'true') return;
    await AsyncStorage.setItem(PUSH_ASKED_KEY, 'true');
    await save(true);
  });
  useEffect(() => {
    if (status === 'signedIn') void ask();
  }, [status]);
}

/** Opens what a tapped push is about: the chat, the post or the profile. */
export function usePushTaps() {
  const router = useRouter();
  const open = useEffectEvent((target: PushTarget) => {
    if (target.type === 'message' && target.conversationId) {
      router.push({ pathname: '/messages/[id]', params: { id: target.conversationId } });
    } else if (target.type === 'follow' && target.actorId) {
      router.push({ pathname: '/user/[id]', params: { id: target.actorId } });
    } else if (target.postId) {
      router.push({ pathname: '/post/[id]', params: { id: target.postId } });
    }
  });
  useEffect(() => listenToPushTaps((target) => open(target)), []);
}
