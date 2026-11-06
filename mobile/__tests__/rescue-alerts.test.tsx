import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import type PocketBase from 'pocketbase';

import * as notificationsApi from '@/features/notifications/api';
import { NotificationList } from '@/features/notifications/NotificationList';
import * as pushApi from '@/features/push/api';
import { NotificationSettings } from '@/features/push/NotificationSettings';
import { useRescueAlertSync } from '@/features/rescue/alertHooks';
import * as api from '@/features/rescue/alerts';
import type { RescueReport } from '@/features/rescue/api';
import * as moderationApi from '@/features/moderation/api';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { notify } from '@/utils/notify';

import { renderWith, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('@/utils/notify', () => ({ notify: jest.fn() }));
jest.mock('@/features/rescue/alerts', () => ({
  ...jest.requireActual('@/features/rescue/alerts'),
  getMyAlert: jest.fn(),
  saveAlert: jest.fn(),
  deleteAlert: jest.fn(),
}));
jest.mock('@/features/push/api', () => ({
  ...jest.requireActual('@/features/push/api'),
  getPushPrefs: jest.fn(),
}));
jest.mock('@/features/notifications/api', () => ({
  ...jest.requireActual('@/features/notifications/api'),
  listNotifications: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));
jest.mock('@/features/moderation/api', () => ({
  ...jest.requireActual('@/features/moderation/api'),
  listBlocks: jest.fn(),
}));

const mockRouter = { push: jest.fn() };
const HERE = { latitude: 19.3467, longitude: -99.1617 };
const ALERT: api.RescueAlert = { id: 'al1', latitude: 19.345, longitude: -99.16, radiusKm: 5 };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(api.getMyAlert).mockResolvedValue(null);
  jest.mocked(api.saveAlert).mockResolvedValue(ALERT);
  jest.mocked(moderationApi.listBlocks).mockResolvedValue([]);
  jest.mocked(pushApi.getPushPrefs).mockResolvedValue({
    id: null,
    prefs: {
      paw: true,
      comment: true,
      follow: true,
      repost: true,
      message: true,
      adoption: true,
      rescue: true,
    },
  });
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    status: 'granted',
  } as never);
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
    status: 'granted',
  } as never);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { ...HERE, accuracy: 10 },
  } as never);
});

describe('alert API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/rescue/alerts');

  it('rounds the location to about 500 m before saving it', async () => {
    expect(actual.roundForAlert(19.3467)).toBe(19.345);
    expect(actual.roundForAlert(-99.1617)).toBe(-99.16);
    const create = jest.fn().mockResolvedValue(ALERT);
    const update = jest.fn().mockResolvedValue(ALERT);
    const client = { collection: () => ({ create, update }) } as unknown as PocketBase;
    await actual.saveAlert(client, 'u1', null, HERE, 10);
    expect(create).toHaveBeenCalledWith({
      user: 'u1',
      latitude: 19.345,
      longitude: -99.16,
      radiusKm: 10,
    });
    await actual.saveAlert(client, 'u1', 'al1', HERE, 5);
    expect(update).toHaveBeenCalledWith('al1', {
      latitude: 19.345,
      longitude: -99.16,
      radiusKm: 5,
    });
  });
});

describe('Settings → Notifications', () => {
  it('turns nearby alerts on with the location and the radius, and off again', async () => {
    await renderWith(<NotificationSettings />, signedIn());
    const toggle = await screen.findByLabelText('Avisarme de casos cerca de mí');
    expect(toggle.props.value).toBe(false);
    expect(
      screen.getByText(
        'Pawly guarda una ubicación aproximada (unos 500 m) y la distancia que elegiste en Ajustes (5 km), y la actualiza al abrir la app. Al apagarlo, se borra.',
      ),
    ).toBeOnTheScreen();

    await fireEvent(toggle, 'valueChange', true);
    await waitFor(() =>
      expect(api.saveAlert).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        null,
        expect.objectContaining(HERE),
        5,
      ),
    );
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByLabelText('Avisarme de casos cerca de mí').props.value).toBe(true),
    );

    await fireEvent(screen.getByLabelText('Avisarme de casos cerca de mí'), 'valueChange', false);
    await waitFor(() => expect(api.deleteAlert).toHaveBeenCalledWith(expect.anything(), 'al1'));
    await waitFor(() =>
      expect(screen.getByLabelText('Avisarme de casos cerca de mí').props.value).toBe(false),
    );
  });

  it('explains that the location is needed when it is not allowed', async () => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      status: 'denied',
    } as never);
    await renderWith(<NotificationSettings />, signedIn());
    await fireEvent(
      await screen.findByLabelText('Avisarme de casos cerca de mí'),
      'valueChange',
      true,
    );
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        'Para avisarte de casos cercanos, Pawly necesita tu ubicación. Actívala en los ajustes del celular.',
      ),
    );
    expect(api.saveAlert).not.toHaveBeenCalled();
  });
});

function Sync() {
  useRescueAlertSync();
  return null;
}

describe('keeping the alert up to date', () => {
  it('saves the new location when the phone moved, without asking', async () => {
    jest.mocked(api.getMyAlert).mockResolvedValue(ALERT);
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
      coords: { latitude: 19.4326, longitude: -99.1332, accuracy: 10 },
    } as never);
    await renderWith(<Sync />, signedIn());
    await waitFor(() =>
      expect(api.saveAlert).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        'al1',
        { latitude: 19.435, longitude: -99.135 },
        5,
      ),
    );
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('does nothing when nothing changed, and saves a new radius', async () => {
    jest.mocked(api.getMyAlert).mockResolvedValue(ALERT);
    await renderWith(<Sync />, signedIn());
    await waitFor(() => expect(Location.getCurrentPositionAsync).toHaveBeenCalled());
    expect(api.saveAlert).not.toHaveBeenCalled();

    jest.clearAllMocks();
    await AsyncStorage.setItem(
      PREFERENCES_KEY,
      '{"theme":"light","language":"es","nearbyRadiusKm":25}',
    );
    await renderWith(<Sync />, signedIn());
    await waitFor(() =>
      expect(api.saveAlert).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        'al1',
        expect.anything(),
        25,
      ),
    );
  });
});

describe('nearby notifications', () => {
  it('say the kind of case and how far it is, and open it', async () => {
    const report = { id: 'r1', collectionId: 'rescue_reports', kind: 'lost', media: [] };
    jest.mocked(notificationsApi.listNotifications).mockResolvedValue({
      items: [
        {
          id: 'n1',
          type: 'rescue_nearby',
          actorId: 'u2',
          actor: { ...TEST_USER, id: 'u2', username: 'sol' },
          postId: '',
          commentText: '',
          adoptionId: '',
          followupMilestone: '',
          rescueId: 'r1',
          rescue: report as unknown as RescueReport,
          distanceKm: 2,
          contentKind: '',
          reportReason: '',
          read: true,
          created: new Date().toISOString(),
        },
      ],
      page: 1,
      hasMore: false,
    });
    await renderWith(<NotificationList />, signedIn());
    await fireEvent.press(await screen.findByText('Mascota perdida a 2 km de ti.'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/rescue/[id]',
      params: { id: 'r1' },
    });
  });
});
