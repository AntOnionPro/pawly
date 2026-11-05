import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import type PocketBase from 'pocketbase';
import { Platform, Pressable, Text } from 'react-native';

import { AUTH_STORAGE_KEY, createClient } from '@/api/client';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import * as pushApi from '@/features/push/api';
import { getPushToken, pushAvailable } from '@/features/push/device';
import {
  PUSH_ASKED_KEY,
  useAskForPushOnce,
  usePushRegistration,
  usePushTaps,
} from '@/features/push/hooks';
import { PREFERENCES_KEY } from '@/preferences/storage';

import { renderWith, signedIn } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo', () => ({ ...jest.requireActual('expo'), isRunningInExpoGo: () => mockExpoGo }));

const mockRouter = { push: jest.fn() };
let mockExpoGo = false;

const PROJECT_ID = 'proyecto-eas';

beforeEach(async () => {
  jest.clearAllMocks();
  mockExpoGo = false;
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID = PROJECT_ID;
  Platform.OS = 'ios';
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({
    status: 'undetermined',
  } as never);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({
    status: 'granted',
  } as never);
  jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({
    type: 'expo',
    data: 'ExponentPushToken[abc]',
  });
});

describe('this phone', () => {
  it('cannot receive push in Expo Go on Android, or without an EAS project', () => {
    expect(pushAvailable()).toBe(true);
    mockExpoGo = true;
    expect(pushAvailable()).toBe(true);
    Platform.OS = 'android';
    expect(pushAvailable()).toBe(false);
    mockExpoGo = false;
    delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    expect(pushAvailable()).toBe(false);
  });

  it('only asks for permission when told to', async () => {
    expect(await getPushToken({ ask: false })).toBeNull();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();

    expect(await getPushToken({ ask: true })).toBe('ExponentPushToken[abc]');
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: PROJECT_ID });
  });

  it('gives no token when permission is denied', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);
    expect(await getPushToken({ ask: true })).toBeNull();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('creates the Android notification channel', async () => {
    Platform.OS = 'android';
    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValue({ status: 'granted' } as never);
    await getPushToken({ ask: false });
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', {
      name: 'Pawly',
      importance: 5,
    });
  });
});

describe('push tokens on the server', () => {
  it('saves the token with platform and language, and remembers it', async () => {
    const create = jest.fn().mockResolvedValue({});
    const client = { collection: () => ({ create }) } as unknown as PocketBase;
    await pushApi.savePushToken(client, 'u1', 'ExponentPushToken[abc]', 'ios', 'es');
    expect(create).toHaveBeenCalledWith({
      user: 'u1',
      token: 'ExponentPushToken[abc]',
      platform: 'ios',
      language: 'es',
    });
    expect(await AsyncStorage.getItem(pushApi.PUSH_TOKEN_KEY)).toBe('ExponentPushToken[abc]');
  });

  it('forgets the token with the session that ended', async () => {
    await AsyncStorage.setItem(pushApi.PUSH_TOKEN_KEY, 'ExponentPushToken[abc]');
    const getFirstListItem = jest.fn().mockResolvedValue({ id: 't1' });
    const remove = jest.fn().mockResolvedValue(true);
    const client = {
      collection: () => ({ getFirstListItem, delete: remove }),
      filter: (expression: string, params: Record<string, string>) =>
        expression.replace('{:token}', `"${params.token}"`),
    } as unknown as PocketBase;
    await pushApi.forgetPushToken(client, 'sesion-vieja');
    const headers = { Authorization: 'sesion-vieja' };
    expect(getFirstListItem).toHaveBeenCalledWith('token = "ExponentPushToken[abc]"', {
      headers,
    });
    expect(remove).toHaveBeenCalledWith('t1', { headers });
    expect(await AsyncStorage.getItem(pushApi.PUSH_TOKEN_KEY)).toBeNull();
  });
});

function Registration() {
  usePushRegistration();
  return null;
}

function AskOnce() {
  useAskForPushOnce();
  return null;
}

describe('registration', () => {
  it('saves the token silently when notifications are already allowed', async () => {
    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValue({ status: 'granted' } as never);
    const save = jest.spyOn(pushApi, 'savePushToken').mockResolvedValue(undefined);
    await renderWith(<Registration />, signedIn());
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        'ExponentPushToken[abc]',
        'ios',
        'es',
      ),
    );
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('asks for permission only the first time', async () => {
    const save = jest.spyOn(pushApi, 'savePushToken').mockResolvedValue(undefined);
    await renderWith(<AskOnce />, signedIn());
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(PUSH_ASKED_KEY)).toBe('true');

    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);
    await renderWith(<AskOnce />, signedIn());
    await act(async () => {});
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});

function Taps() {
  usePushTaps();
  return null;
}

describe('tapping a push', () => {
  it('opens the chat, the profile or the post', async () => {
    let tap: ((response: unknown) => void) | undefined;
    jest
      .mocked(Notifications.addNotificationResponseReceivedListener)
      .mockImplementation((listener) => {
        tap = listener as (response: unknown) => void;
        return { remove: jest.fn() };
      });
    const open = (data: Record<string, string>) =>
      act(async () => tap?.({ notification: { request: { content: { data } } } }));
    await render(<Taps />);

    await open({ type: 'message', conversationId: 'c1' });
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/messages/[id]',
      params: { id: 'c1' },
    });
    await open({ type: 'follow', actorId: 'u2' });
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/user/[id]',
      params: { id: 'u2' },
    });
    await open({ type: 'paw', postId: 'p1', actorId: 'u2' });
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/post/[id]',
      params: { id: 'p1' },
    });
  });

  it('opens the push that launched the app', async () => {
    jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue({
      notification: { request: { content: { data: { type: 'comment', postId: 'p9' } } } },
    } as never);
    await render(<Taps />);
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/post/[id]',
        params: { id: 'p9' },
      }),
    );
  });
});

function SignOut() {
  const { status, signOut } = useAuth();
  return (
    <Pressable accessibilityRole="button" onPress={signOut}>
      <Text>{status}</Text>
    </Pressable>
  );
}

describe('signing out', () => {
  it("removes this phone's token with the session that ends", async () => {
    const payload = { id: 'u1', type: 'auth', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = ['e30', btoa(JSON.stringify(payload)), 'firma'].join('.');
    await AsyncStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token, record: { id: 'u1', collectionName: 'users', username: 'luna' } }),
    );
    await AsyncStorage.setItem(pushApi.PUSH_TOKEN_KEY, 'ExponentPushToken[abc]');
    const fetchMock = jest.fn((url: string) =>
      Promise.resolve(
        new Response(
          url.includes('auth-refresh')
            ? JSON.stringify({ token, record: { id: 'u1', username: 'luna' } })
            : url.includes('/records?')
              ? JSON.stringify({ items: [{ id: 't1' }], page: 1, perPage: 1, totalItems: 1 })
              : '',
          { status: url.includes('/records/t1') ? 204 : 200 },
        ),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const client = createClient('http://pawly.test');
    await render(
      <AuthProvider client={client}>
        <SignOut />
      </AuthProvider>,
    );
    await screen.findByText('signedIn');
    await fireEvent.press(screen.getByRole('button'));
    expect(screen.getByText('visitor')).toBeOnTheScreen();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/collections/push_tokens/records/t1'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({ Authorization: token }),
        }),
      ),
    );
  });
});
