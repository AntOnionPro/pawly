import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import type PocketBase from 'pocketbase';
import { Linking, Platform } from 'react-native';

import * as api from '@/features/push/api';
import { getPushPermission } from '@/features/push/device';
import { NotificationSettings } from '@/features/push/NotificationSettings';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { notify } from '@/utils/notify';

import { renderWith, serverError, signedIn } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo', () => ({ ...jest.requireActual('expo'), isRunningInExpoGo: () => mockExpoGo }));
jest.mock('@/utils/notify', () => ({ notify: jest.fn() }));
jest.mock('@/features/push/api', () => ({
  ...jest.requireActual('@/features/push/api'),
  getPushPrefs: jest.fn(),
  savePushPrefs: jest.fn(),
  savePushToken: jest.fn(),
}));

let mockExpoGo = false;

const ALL_ON: api.PushPrefs = {
  paw: true,
  comment: true,
  follow: true,
  repost: true,
  message: true,
  adoption: true,
  rescue: true,
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockExpoGo = false;
  Platform.OS = 'ios';
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID = 'proyecto-eas';
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(api.getPushPrefs).mockResolvedValue({ id: null, prefs: { ...ALL_ON } });
  jest.mocked(api.savePushPrefs).mockResolvedValue('prefs1');
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);
  jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({
    type: 'expo',
    data: 'ExponentPushToken[abc]',
  });
});

describe('preferences API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/push/api');

  function fakeClient(items: unknown[]) {
    const getList = jest.fn().mockResolvedValue({ items });
    const create = jest.fn().mockResolvedValue({ id: 'new' });
    const update = jest.fn().mockResolvedValue({ id: 'old' });
    const client = {
      collection: () => ({ getList, create, update }),
      filter: (expression: string, params: Record<string, string>) =>
        expression.replace('{:user}', `"${params.user}"`),
    } as unknown as PocketBase;
    return { client, getList, create, update };
  }

  it('reads everything on when nothing was saved, and the saved types that are off', async () => {
    expect(await actual.getPushPrefs(fakeClient([]).client, 'u1')).toEqual({
      id: null,
      prefs: ALL_ON,
    });
    const { client, getList } = fakeClient([{ id: 'p1', pawOff: true, messageOff: true }]);
    expect(await actual.getPushPrefs(client, 'u1')).toEqual({
      id: 'p1',
      prefs: { ...ALL_ON, paw: false, message: false },
    });
    expect(getList).toHaveBeenCalledWith(1, 1, { filter: 'user = "u1"', skipTotal: true });
  });

  it('creates the record the first time and updates it afterwards', async () => {
    const { client, create, update } = fakeClient([]);
    const prefs = { ...ALL_ON, follow: false };
    expect(await actual.savePushPrefs(client, 'u1', { id: null, prefs })).toBe('new');
    expect(create).toHaveBeenCalledWith({
      user: 'u1',
      pawOff: false,
      commentOff: false,
      followOff: true,
      repostOff: false,
      messageOff: false,
      adoptionOff: false,
      rescueOff: false,
    });
    await actual.savePushPrefs(client, 'u1', { id: 'old', prefs });
    expect(update).toHaveBeenCalledWith('old', expect.objectContaining({ followOff: true }));
  });
});

describe('permission', () => {
  it('reads the phone permission, or says push is not possible', async () => {
    expect(await getPushPermission()).toBe('granted');
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);
    expect(await getPushPermission()).toBe('denied');
    Platform.OS = 'android';
    mockExpoGo = true;
    expect(await getPushPermission()).toBe('unavailable');
  });
});

describe('notification settings', () => {
  it('shows a switch per type and saves a change at once', async () => {
    await renderWith(<NotificationSettings />, signedIn());
    const paw = await screen.findByLabelText('Huellas');
    for (const label of [
      'Comentarios',
      'Nuevos seguidores',
      'Republicaciones',
      'Mensajes',
      'Adopciones',
      'Rescate',
    ]) {
      expect(screen.getByLabelText(label).props.value).toBe(true);
    }
    await fireEvent(paw, 'valueChange', false);
    // The cached preferences change in onMutate, and React Query redraws on a timer.
    await waitFor(() => expect(screen.getByLabelText('Huellas').props.value).toBe(false));
    await waitFor(() =>
      expect(api.savePushPrefs).toHaveBeenCalledWith(expect.anything(), 'u1', {
        id: null,
        prefs: { ...ALL_ON, paw: false },
      }),
    );
  });

  it('goes back and explains if saving fails', async () => {
    jest.mocked(api.savePushPrefs).mockRejectedValue(serverError(0));
    await renderWith(<NotificationSettings />, signedIn());
    await fireEvent(await screen.findByLabelText('Mensajes'), 'valueChange', false);
    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(jest.mocked(notify).mock.calls[0]?.[0]).toContain('No se pudo guardar el cambio.');
    expect(screen.getByLabelText('Mensajes').props.value).toBe(true);
  });

  it('offers to turn notifications on when they were never asked', async () => {
    jest
      .mocked(Notifications.getPermissionsAsync)
      .mockResolvedValue({ status: 'undetermined' } as never);
    jest
      .mocked(Notifications.requestPermissionsAsync)
      .mockResolvedValue({ status: 'granted' } as never);
    await renderWith(<NotificationSettings />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Activar notificaciones' }));
    await waitFor(() =>
      expect(api.savePushToken).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        'ExponentPushToken[abc]',
        'ios',
        'es',
      ),
    );
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('sends to the phone settings when notifications are off there', async () => {
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderWith(<NotificationSettings />, signedIn());
    expect(
      await screen.findByText(
        'Las notificaciones de Pawly están desactivadas en los ajustes del celular.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir ajustes del celular' }));
    expect(openSettings).toHaveBeenCalled();
  });

  it('says when this phone cannot receive push yet', async () => {
    Platform.OS = 'android';
    mockExpoGo = true;
    await renderWith(<NotificationSettings />, signedIn());
    expect(
      await screen.findByText(
        'Este celular todavía no puede recibir notificaciones push de Pawly.',
      ),
    ).toBeOnTheScreen();
  });
});
