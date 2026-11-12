import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { AUTH_STORAGE_KEY, createClient } from '@/api/client';
import { AuthProvider, useAuth, type AuthContextValue } from '@/auth/AuthProvider';
import { PreferencesProvider, usePreferences } from '@/preferences/PreferencesProvider';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { notify } from '@/utils/notify';

jest.mock('@/utils/notify', () => ({ notify: jest.fn() }));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));

// Uploads use React Native's XMLHttpRequest on phones (tested in upload.test.ts); here they go
// through the same mocked fetch as every other request.
jest.mock('@/utils/upload', () => ({
  ...jest.requireActual('@/utils/upload'),
  uploadFetch: (url: string, config: RequestInit) => globalThis.fetch(url, config),
}));

const RECORD = {
  id: 'u1',
  collectionId: '_pb_users_auth_',
  collectionName: 'users',
  username: 'luna',
  email: 'luna@ejemplo.com',
  bio: 'Tengo una perrita.',
  avatar: '',
  verified: true,
};

/** A JWT that PocketBase's SDK considers valid (only the expiry is checked locally). */
function fakeToken(): string {
  const payload = { id: 'u1', type: 'auth', exp: Math.floor(Date.now() / 1000) + 3600 };
  return ['e30', btoa(JSON.stringify(payload)), 'firma'].join('.');
}

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function Status() {
  const { status, user } = useAuth();
  return <Text>{status === 'signedIn' ? `signedIn:${user?.username}` : status}</Text>;
}

async function renderProvider() {
  const client = createClient('http://pawly.test');
  await render(
    <AuthProvider client={client}>
      <Status />
    </AuthProvider>,
  );
  return client;
}

describe('AuthProvider', () => {
  const fetchMock = jest.fn();

  beforeEach(async () => {
    await AsyncStorage.clear();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('starts as a visitor when there is no saved session', async () => {
    await renderProvider();
    expect(await screen.findByText('visitor')).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restores a saved session and refreshes the profile', async () => {
    await AsyncStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token: fakeToken(), record: RECORD }),
    );
    fetchMock.mockImplementation(() =>
      jsonResponse(200, { token: fakeToken(), record: { ...RECORD, username: 'luna.mx' } }),
    );
    await renderProvider();
    expect(await screen.findByText('signedIn:luna.mx')).toBeOnTheScreen();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/collections/users/auth-refresh');
  });

  it('signs out if the server rejects the saved session (deleted account)', async () => {
    await AsyncStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token: fakeToken(), record: RECORD }),
    );
    fetchMock.mockImplementation(() => jsonResponse(401, { status: 401, message: 'x', data: {} }));
    await renderProvider();
    expect(await screen.findByText('visitor')).toBeOnTheScreen();
    expect(await AsyncStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('keeps the saved session when the server cannot be reached', async () => {
    await AsyncStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ token: fakeToken(), record: RECORD }),
    );
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Network request failed')));
    await renderProvider();
    expect(await screen.findByText('signedIn:luna')).toBeOnTheScreen();
  });

  describe('a suspended account', () => {
    const SUSPENDED = {
      status: 403,
      message: 'This account is suspended.',
      data: { account: { code: 'account_suspended', message: 'x' } },
      suspension: { until: '', forever: true, reason: 'Maltrato animal' },
    };
    const TEXT = 'Tu cuenta está suspendida de forma permanente. Motivo: Maltrato animal';

    function Ready({ children }: { children: React.ReactNode }) {
      return usePreferences().ready ? children : null;
    }

    async function renderInSpanish(client = createClient('http://pawly.test')) {
      await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
      await render(
        <PreferencesProvider>
          <Ready>
            <AuthProvider client={client}>
              <Status />
            </AuthProvider>
          </Ready>
        </PreferencesProvider>,
      );
      return client;
    }

    beforeEach(() => {
      jest.mocked(notify).mockClear();
    });

    it('is signed out when the app opens, and told why', async () => {
      await AsyncStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ token: fakeToken(), record: RECORD }),
      );
      fetchMock.mockImplementation(() => jsonResponse(403, SUSPENDED));
      await renderInSpanish();
      expect(await screen.findByText('visitor')).toBeOnTheScreen();
      expect(await AsyncStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
      expect(notify).toHaveBeenCalledWith(TEXT);
    });

    it('is signed out at its next request, and told once', async () => {
      await AsyncStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ token: fakeToken(), record: RECORD }),
      );
      fetchMock.mockImplementationOnce(() =>
        jsonResponse(200, { token: fakeToken(), record: RECORD }),
      );
      const client = await renderInSpanish();
      expect(await screen.findByText('signedIn:luna')).toBeOnTheScreen();

      fetchMock.mockImplementation(() => jsonResponse(403, SUSPENDED));
      const requests = [
        client.collection('posts').getList(1, 10),
        client.collection('notifications').getList(1, 10),
      ];
      await Promise.allSettled(requests);
      expect(await screen.findByText('visitor')).toBeOnTheScreen();
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith(TEXT);
    });

    it('is not announced when signing in (the form says it)', async () => {
      fetchMock.mockImplementation(() => jsonResponse(403, SUSPENDED));
      const client = await renderInSpanish();
      await screen.findByText('visitor');
      await expect(
        client.collection('users').authWithPassword('luna@ejemplo.com', '12345678'),
      ).rejects.toMatchObject({ status: 403 });
      expect(notify).not.toHaveBeenCalled();
    });
  });

  describe('account actions', () => {
    let auth: AuthContextValue;

    // Hands the session to the test after each render (outside of render itself).
    function Capture({ onAuth }: { onAuth: (value: AuthContextValue) => void }) {
      const value = useAuth();
      useEffect(() => {
        onAuth(value);
      });
      return <Status />;
    }

    async function renderSignedIn() {
      await AsyncStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ token: fakeToken(), record: RECORD }),
      );
      fetchMock.mockImplementationOnce(() =>
        jsonResponse(200, { token: fakeToken(), record: RECORD }),
      );
      const client = createClient('http://pawly.test');
      await render(
        <AuthProvider client={client}>
          <Capture onAuth={(value) => (auth = value)} />
        </AuthProvider>,
      );
      await screen.findByText('signedIn:luna');
      fetchMock.mockReset();
    }

    const calls = () =>
      fetchMock.mock.calls.map(
        ([url, init]) => `${init?.method ?? 'GET'} ${String(url).replace('http://pawly.test', '')}`,
      );

    it('changes the password and signs in again with the new one', async () => {
      await renderSignedIn();
      fetchMock
        .mockImplementationOnce(() => jsonResponse(200, RECORD))
        .mockImplementationOnce(() => jsonResponse(200, { token: fakeToken(), record: RECORD }));
      await auth.changePassword('vieja-clave', 'nueva-clave-1', 'nueva-clave-1');
      expect(calls()).toEqual([
        'PATCH /api/collections/users/records/u1',
        'POST /api/collections/users/auth-with-password',
      ]);
      const login = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
      expect(login).toEqual({ identity: 'luna@ejemplo.com', password: 'nueva-clave-1' });
    });

    it('checks the password, deletes the account and signs out', async () => {
      await renderSignedIn();
      fetchMock
        .mockImplementationOnce(() => jsonResponse(200, { token: fakeToken(), record: RECORD }))
        .mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 204 })));
      await auth.deleteAccount('mi-clave');
      expect(calls()).toEqual([
        'POST /api/collections/users/auth-with-password',
        'DELETE /api/collections/users/records/u1',
      ]);
      expect(await screen.findByText('visitor')).toBeOnTheScreen();
      expect(await AsyncStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    });

    it('does not delete anything if the password is wrong', async () => {
      await renderSignedIn();
      fetchMock.mockImplementationOnce(() =>
        jsonResponse(400, { status: 400, message: 'Failed to authenticate.', data: {} }),
      );
      await expect(auth.deleteAccount('equivocada')).rejects.toMatchObject({ status: 400 });
      expect(calls()).toEqual(['POST /api/collections/users/auth-with-password']);
      expect(screen.getByText('signedIn:luna')).toBeOnTheScreen();
    });

    it('updates the profile, including removing the photo', async () => {
      await renderSignedIn();
      fetchMock.mockImplementationOnce(() =>
        jsonResponse(200, { ...RECORD, username: 'luna.mx', bio: '', avatar: '' }),
      );
      await auth.updateProfile({ username: 'Luna.MX', bio: '  ', avatar: null });
      expect(calls()).toEqual(['PATCH /api/collections/users/records/u1']);
      const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
      expect(body.get('username')).toBe('luna.mx');
      expect(body.get('bio')).toBe('');
      expect(body.get('avatar')).toBe('');
      expect(await screen.findByText('signedIn:luna.mx')).toBeOnTheScreen();
    });

    it('saves the shelter or rescuer profile, with its point and its needs', async () => {
      await renderSignedIn();
      fetchMock.mockImplementation(() => jsonResponse(200, RECORD));
      await auth.updateProfile({
        shelter: {
          zone: ' Tlalpan, CDMX ',
          location: { latitude: 19.2869, longitude: -99.1672 },
          hours: ' 10 a 17 h ',
          needs: ['food', 'foster'],
          needsNote: ' Croquetas ',
        },
      });
      const sent = fetchMock.mock.calls[0]?.[1]?.body as FormData;
      expect(sent.get('zone')).toBe('Tlalpan, CDMX');
      expect(sent.get('latitude')).toBe('19.2869');
      expect(sent.get('longitude')).toBe('-99.1672');
      expect(sent.get('hours')).toBe('10 a 17 h');
      expect(sent.getAll('needs')).toEqual(['food', 'foster']);
      expect(sent.get('needsNote')).toBe('Croquetas');
      // The username, the bio and the photo are left as they are.
      expect(sent.has('username')).toBe(false);
      expect(sent.has('avatar')).toBe(false);

      // Without a point and without needs, both are emptied.
      await auth.updateProfile({
        shelter: { zone: '', location: null, hours: '', needs: [], needsNote: '' },
      });
      const emptied = fetchMock.mock.calls[1]?.[1]?.body as FormData;
      expect(emptied.get('latitude')).toBe('0');
      expect(emptied.get('longitude')).toBe('0');
      expect(emptied.getAll('needs')).toEqual(['']);
    });
  });
});
