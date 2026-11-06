import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import type PocketBase from 'pocketbase';

import * as moderationApi from '@/features/moderation/api';
import * as petsApi from '@/features/pets/api';
import * as api from '@/features/rescue/api';
import { RescueDetail } from '@/features/rescue/RescueDetail';
import { RescueForm } from '@/features/rescue/RescueForm';
import { RescueList } from '@/features/rescue/RescueList';
import { SettingsContent } from '@/features/settings/SettingsContent';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { boundingBox, distanceKm, regionAround } from '@/utils/geo';

import { authValue, renderWith, signedIn, TEST_USER } from '../test-utils/render';

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
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
jest.mock('@/features/rescue/api', () => ({
  ...jest.requireActual('@/features/rescue/api'),
  listRescueReports: jest.fn(),
  listNearbyRescueReports: jest.fn(),
  createRescueReport: jest.fn(),
}));
jest.mock('@/features/pets/api', () => ({
  ...jest.requireActual('@/features/pets/api'),
  listPets: jest.fn(),
}));
jest.mock('@/features/moderation/api', () => ({
  ...jest.requireActual('@/features/moderation/api'),
  listBlocks: jest.fn(),
}));

const mockRouter = { push: jest.fn() };

const SOL = { ...TEST_USER, id: 'u2', username: 'sol', bio: '' };
/** Coyoacán and the Zócalo, in Mexico City. */
const COYOACAN = { latitude: 19.3467, longitude: -99.1617 };
const ZOCALO = { latitude: 19.4326, longitude: -99.1332 };

function report(id: string, overrides: Partial<api.RescueReport> = {}): api.RescueReport {
  return {
    id,
    collectionId: 'rescue_reports',
    reporterId: 'u2',
    reporter: SOL,
    kind: 'help',
    description: `Caso ${id}`,
    media: [],
    ...COYOACAN,
    place: '',
    urgency: 'medium',
    petId: '',
    lastSeenAt: '',
    status: 'open',
    created: new Date().toISOString(),
    ...overrides,
  };
}

function allowLocation(status: 'granted' | 'undetermined' | 'denied') {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({ status } as never);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(moderationApi.listBlocks).mockResolvedValue([]);
  jest.mocked(petsApi.listPets).mockResolvedValue([]);
  allowLocation('granted');
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    status: 'granted',
  } as never);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { ...COYOACAN, accuracy: 10 },
  } as never);
  jest
    .mocked(api.listRescueReports)
    .mockResolvedValue({ items: [report('lejos')], page: 1, hasMore: false });
  jest.mocked(api.listNearbyRescueReports).mockResolvedValue([
    { ...report('cerca'), distanceKm: 0.35 },
    { ...report('medio', { kind: 'lost', urgency: '' }), distanceKm: 1.24 },
  ]);
});

describe('distances', () => {
  it('measures between two points and builds the area around one', () => {
    const km = distanceKm(COYOACAN, ZOCALO);
    expect(km).toBeGreaterThan(9.5);
    expect(km).toBeLessThan(10.5);
    expect(distanceKm(COYOACAN, COYOACAN)).toBe(0);

    const box = boundingBox(COYOACAN, 10);
    expect(box.minLat).toBeLessThan(ZOCALO.latitude - 0.05);
    expect(box.maxLat).toBeGreaterThan(ZOCALO.latitude);
    expect(box.minLng).toBeLessThan(COYOACAN.longitude);
    expect(box.maxLng).toBeGreaterThan(ZOCALO.longitude);
    expect(regionAround(COYOACAN, 5).latitudeDelta).toBeGreaterThan(0.09);
  });

  it('asks the server for the area and keeps the nearest inside the radius', async () => {
    const actual = jest.requireActual<typeof api>('@/features/rescue/api');
    const getList = jest.fn().mockResolvedValue({
      items: [
        { id: 'zocalo', collectionId: 'c', ...ZOCALO, kind: 'help', status: 'open' },
        { id: 'aqui', collectionId: 'c', ...COYOACAN, kind: 'help', status: 'open' },
      ],
    });
    const filter = jest.fn((expression: string) => expression);
    const client = { collection: () => ({ getList }), filter } as unknown as PocketBase;

    const near = await actual.listNearbyRescueReports(client, COYOACAN, 5, {});
    expect(near.map((item) => item.id)).toEqual(['aqui']);
    expect(near[0]?.distanceKm).toBe(0);
    expect(filter).toHaveBeenCalledWith(
      expect.stringContaining('latitude >= {:minLat}'),
      boundingBox(COYOACAN, 5),
    );

    const wide = await actual.listNearbyRescueReports(client, COYOACAN, 25, {});
    expect(wide.map((item) => item.id)).toEqual(['aqui', 'zocalo']);
    expect(getList).toHaveBeenLastCalledWith(
      1,
      200,
      expect.objectContaining({ sort: '-created,-id' }),
    );
  });
});

describe('nearby cases', () => {
  it('lists the cases within the radius, nearest first, with their distance', async () => {
    await renderWith(<RescueList />, authValue());
    expect(await screen.findByText('Casos a 5 km de ti')).toBeOnTheScreen();
    expect(screen.getByText(/^a 350 m · /)).toBeOnTheScreen();
    expect(screen.getByText(/^a 1.2 km · /)).toBeOnTheScreen();
    expect(api.listNearbyRescueReports).toHaveBeenCalledWith(
      expect.anything(),
      { latitude: 19.347, longitude: -99.162 },
      5,
      {},
    );
    expect(api.listRescueReports).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar distancia' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings');
  });

  it('uses the radius chosen in Settings', async () => {
    await AsyncStorage.setItem(
      PREFERENCES_KEY,
      '{"theme":"light","language":"es","nearbyRadiusKm":25}',
    );
    jest.mocked(api.listNearbyRescueReports).mockResolvedValue([]);
    await renderWith(<RescueList />, authValue());
    expect(await screen.findByText('No hay casos abiertos a 25 km de ti.')).toBeOnTheScreen();
  });

  it('shows every case and invites to use the location until it is allowed', async () => {
    allowLocation('undetermined');
    await renderWith(<RescueList />, authValue());
    expect(await screen.findByText('Caso lejos')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Usa tu ubicación para ver los casos cercanos, del más cercano al más lejano.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Usar mi ubicación' }));
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(await screen.findByText('Casos a 5 km de ti')).toBeOnTheScreen();
  });

  it('explains how to turn the location on when it was denied', async () => {
    allowLocation('denied');
    await renderWith(<RescueList />, authValue());
    expect(
      await screen.findByText(
        'Para ver los casos cercanos, activa el permiso de ubicación de Pawly en los ajustes del celular.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Abrir ajustes del celular' })).toBeOnTheScreen();
  });
});

describe('map', () => {
  it('shows a marker per case; tapping one shows the case, which opens it', async () => {
    await renderWith(<RescueList />, authValue());
    await screen.findByText('Caso cerca');
    await fireEvent.press(screen.getByRole('button', { name: 'Mapa' }));
    expect(screen.getByTestId('rescue-map')).toBeOnTheScreen();
    expect(screen.queryByText('Caso cerca')).toBeNull();

    const markers = screen.getAllByRole('button', { name: /^(Necesita ayuda|Perdido)$/ });
    expect(markers).toHaveLength(2);
    await fireEvent(markers[1]!, 'press', { stopPropagation: jest.fn() });
    await fireEvent.press(await screen.findByRole('link', { name: /^Perdido/ }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/rescue/[id]',
      params: { id: 'medio' },
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Lista' }));
    expect(screen.getByText('Caso cerca')).toBeOnTheScreen();
  });

  it('shows where a report is on its page', async () => {
    await renderWith(
      <RescueDetail report={report('r1')} onPressPet={jest.fn()} onPressUser={jest.fn()} />,
      authValue(),
    );
    expect(await screen.findByTestId('point-map')).toBeOnTheScreen();
  });

  it('places the report by tapping the map', async () => {
    jest.mocked(api.createRescueReport).mockResolvedValue(report('nuevo'));
    await renderWith(<RescueForm kind="found" onSaved={jest.fn()} />, signedIn());
    await fireEvent.changeText(await screen.findByLabelText('Descripción'), 'Gato con collar');
    await fireEvent(screen.getByTestId('pick-map'), 'press', {
      nativeEvent: { coordinate: { latitude: 19.4, longitude: -99.15 } },
    });
    expect(screen.getByText('Ubicación guardada.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar reporte' }));
    expect(api.createRescueReport).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      expect.objectContaining({ kind: 'found', latitude: 19.4, longitude: -99.15 }),
    );
  });
});

describe('settings', () => {
  it('saves the nearby radius on the phone', async () => {
    await renderWith(<SettingsContent />, authValue());
    expect(await screen.findByRole('radio', { name: 'A 5 km', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'A 10 km' }));
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(PREFERENCES_KEY)) ?? '{}')).toMatchObject({
        nearbyRadiusKm: 10,
      }),
    );
  });
});
