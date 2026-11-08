import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type PocketBase from 'pocketbase';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { useResetOnAccountChange } from '@/api/useResetOnAccountChange';
import { AuthContext, type AuthContextValue } from '@/auth/AuthProvider';
import * as api from '@/features/posts/api';
import { FeedList } from '@/features/posts/FeedList';
import { PREFERENCES_KEY } from '@/preferences/storage';

import { authValue, renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
jest.mock('@/features/posts/api', () => ({
  ...jest.requireActual('@/features/posts/api'),
  listPosts: jest.fn(),
}));

const SOL = { ...TEST_USER, id: 'u2', username: 'sol' };

const POST: api.Post = {
  id: 'post1',
  collectionId: 'posts',
  authorId: 'u3',
  author: { ...TEST_USER, id: 'u3', username: 'rocco' },
  text: 'Mi perrita',
  media: [],
  petIds: [],
  pets: [],
  created: new Date().toISOString(),
  pawCount: 1,
  commentCount: 0,
  pawedByMe: false,
  myPawId: null,
  repostCount: 0,
  repostOfId: null,
  repostedByMe: false,
  myRepostId: null,
};

/** What the server says about the post for whoever is signed in now. */
let mockSignedInAs: string | null = 'u1';

beforeEach(async () => {
  jest.clearAllMocks();
  mockSignedInAs = 'u1';
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(api.listPosts).mockImplementation(async () => ({
    items: [mockSignedInAs === 'u1' ? { ...POST, pawedByMe: true, myPawId: 'paw-of-u1' } : POST],
    page: 1,
    hasMore: false,
  }));
});

/** The feed, with buttons to change the session as the app does. */
function SwitchingAccounts() {
  const [auth, setAuth] = useState<AuthContextValue>(signedIn());
  const change = (next: AuthContextValue) => {
    mockSignedInAs = next.user?.id ?? null;
    setAuth(next);
  };
  return (
    <AuthContext.Provider value={auth}>
      <Reset />
      <Pressable accessibilityRole="button" onPress={() => change(signedIn({ user: SOL }))}>
        <Text>Entrar como sol</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => change(authValue())}>
        <Text>Salir</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => change(signedIn({ user: { ...TEST_USER, bio: 'Nueva bio' } }))}>
        <Text>Editar perfil</Text>
      </Pressable>
      <FeedList />
    </AuthContext.Provider>
  );
}

function Reset() {
  useResetOnAccountChange();
  return null;
}

describe('changing accounts', () => {
  it('shows the new account its own paw prints, not those of the previous one', async () => {
    await renderWith(<SwitchingAccounts />);
    // Discover is the same list for everyone: only the paw prints depend on the account.
    await fireEvent.press(await screen.findByRole('tab', { name: 'Descubrir' }));
    expect(await screen.findByRole('button', { name: 'Quitar tu huella' })).toBeOnTheScreen();
    const loads = jest.mocked(api.listPosts).mock.calls.length;

    await fireEvent.press(screen.getByRole('button', { name: 'Entrar como sol' }));
    expect(await screen.findByRole('button', { name: 'Dar huella' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Quitar tu huella' })).toBeNull();
    expect(api.listPosts).toHaveBeenCalledTimes(loads + 1);
  });

  it('forgets the paw prints when signing out', async () => {
    await renderWith(<SwitchingAccounts />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Descubrir' }));
    await screen.findByRole('button', { name: 'Quitar tu huella' });
    await fireEvent.press(screen.getByRole('button', { name: 'Salir' }));
    expect(await screen.findByRole('button', { name: 'Dar huella' })).toBeOnTheScreen();
  });

  it('keeps what was loaded when the same account changes its profile', async () => {
    await renderWith(<SwitchingAccounts />);
    await screen.findByRole('button', { name: 'Quitar tu huella' });
    await fireEvent.press(screen.getByRole('button', { name: 'Editar perfil' }));
    await waitFor(() => expect(api.listPosts).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Quitar tu huella' })).toBeOnTheScreen();
  });
});

describe('removePaw', () => {
  const { removePaw } = jest.requireActual<typeof api>('@/features/posts/api');

  it('does not fail when the paw print is already gone', async () => {
    const remove = jest.fn().mockRejectedValue(serverError(404));
    const client = { collection: () => ({ delete: remove }) } as unknown as PocketBase;
    await expect(removePaw(client, 'u1', 'post1', 'paw1')).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith('paw1');
  });

  it('still reports other errors', async () => {
    const client = {
      collection: () => ({ delete: jest.fn().mockRejectedValue(serverError(0)) }),
    } as unknown as PocketBase;
    await expect(removePaw(client, 'u1', 'post1', 'paw1')).rejects.toMatchObject({ status: 0 });
  });
});
