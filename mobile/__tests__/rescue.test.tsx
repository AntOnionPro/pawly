import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import type PocketBase from 'pocketbase';
import { Linking } from 'react-native';

import * as moderationApi from '@/features/moderation/api';
import * as petsApi from '@/features/pets/api';
import * as api from '@/features/rescue/api';
import { PetLostButton } from '@/features/rescue/PetLostButton';
import { RescueDetail } from '@/features/rescue/RescueDetail';
import { RescueForm, validateRescue } from '@/features/rescue/RescueForm';
import { RescueList } from '@/features/rescue/RescueList';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { confirm } from '@/utils/confirm';

import { authValue, renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('@/components/DateField', () => jest.requireActual('../test-utils/mocks/DateField'));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
jest.mock('@/features/rescue/api', () => ({
  ...jest.requireActual('@/features/rescue/api'),
  listRescueReports: jest.fn(),
  createRescueReport: jest.fn(),
  updateRescueReport: jest.fn(),
  setRescueStatus: jest.fn(),
  deleteRescueReport: jest.fn(),
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

const LUNA_PET: petsApi.Pet = {
  id: 'p1',
  collectionId: 'pets',
  ownerId: 'u1',
  name: 'Luna',
  species: 'dog',
  breed: '',
  birthDate: '',
  photo: '',
  previousOwnerId: '',
  adoptedAt: '',
};

function report(id: string, overrides: Partial<api.RescueReport> = {}): api.RescueReport {
  return {
    id,
    collectionId: 'rescue_reports',
    reporterId: 'u2',
    reporter: SOL,
    kind: 'help',
    description: 'Perrito herido junto al mercado',
    media: [],
    latitude: 19.35,
    longitude: -99.16,
    place: 'Mercado de Coyoacán',
    urgency: 'high',
    petId: '',
    lastSeenAt: '',
    status: 'open',
    helperCount: 0,
    created: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(moderationApi.listBlocks).mockResolvedValue([]);
  jest.mocked(petsApi.listPets).mockResolvedValue([LUNA_PET]);
  jest
    .mocked(api.listRescueReports)
    .mockResolvedValue({ items: [report('r1')], page: 1, hasMore: false });
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    status: 'granted',
  } as never);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 19.4326, longitude: -99.1332, accuracy: 12.4 },
  } as never);
  jest.mocked(confirm).mockResolvedValue(true);
});

describe('rescue API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/rescue/api');

  it('maps a report with its reporter and pet', () => {
    const mapped = actual.toRescueReport({
      id: 'r1',
      collectionId: 'rescue_reports',
      collectionName: 'rescue_reports',
      reporter: 'u2',
      kind: 'lost',
      description: 'Se escapó',
      latitude: 19.4,
      longitude: -99.1,
      pet: 'p1',
      lastSeenAt: '2026-11-04 12:00:00.000Z',
      status: 'open',
      expand: {
        reporter: { id: 'u2', collectionId: 'users', collectionName: 'users', username: 'sol' },
        pet: { id: 'p1', collectionId: 'pets', collectionName: 'pets', name: 'Luna' },
      },
    });
    expect(mapped).toMatchObject({ kind: 'lost', latitude: 19.4, petId: 'p1', urgency: '' });
    expect(mapped.reporter?.username).toBe('sol');
    expect(mapped.pet?.name).toBe('Luna');
  });

  it('lists the open reports of a kind, newest first', async () => {
    const getList = jest.fn().mockResolvedValue({ items: [] });
    const client = {
      collection: () => ({ getList }),
      filter: (expression: string, params: Record<string, string>) =>
        expression.replace('{:kind}', `"${params.kind}"`),
    } as unknown as PocketBase;
    await actual.listRescueReports(client, { kind: 'found' }, 2);
    expect(getList).toHaveBeenCalledWith(2, 20, {
      filter: 'status != \'closed\' && kind = "found"',
      sort: '-created,-id',
      expand: 'reporter,pet',
      skipTotal: true,
    });
  });

  it('sends only the fields of each kind', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'r1', collectionId: 'rescue_reports' });
    const client = { collection: () => ({ create }) } as unknown as PocketBase;
    await actual.createRescueReport(client, 'u1', {
      kind: 'lost',
      description: ' Se escapó ',
      place: '',
      urgency: 'high',
      petId: 'p1',
      lastSeenDate: '2026-11-04',
      latitude: 19.4,
      longitude: -99.1,
      newMedia: [],
      removedMedia: [],
    });
    const form = create.mock.calls[0]?.[0] as FormData;
    expect(form.get('reporter')).toBe('u1');
    expect(form.get('kind')).toBe('lost');
    expect(form.get('description')).toBe('Se escapó');
    expect(form.get('urgency')).toBe('');
    expect(form.get('pet')).toBe('p1');
    expect(form.get('lastSeenAt')).toBe('2026-11-04 12:00:00.000Z');
    expect(form.get('latitude')).toBe('19.4');
  });

  it('validates the form', () => {
    expect(
      validateRescue({
        kind: 'help',
        description: ' ',
        place: '',
        urgency: '',
        petId: '',
        lastSeenDate: '',
        latitude: null,
        longitude: null,
      }),
    ).toEqual({
      description: 'errors.required',
      urgency: 'errors.required',
      latitude: 'errors.locationRequired',
    });
  });
});

describe('Rescue tab', () => {
  it('shows each open case and opens it', async () => {
    await renderWith(<RescueList />, authValue());
    expect(await screen.findByText('Perrito herido junto al mercado')).toBeOnTheScreen();
    expect(screen.getByText('Necesita ayuda')).toBeOnTheScreen();
    expect(screen.getByText('Urgencia alta')).toBeOnTheScreen();
    expect(screen.getByText(/^Mercado de Coyoacán · /)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: /^Necesita ayuda, Urgencia alta/ }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/rescue/[id]',
      params: { id: 'r1' },
    });
  });

  it('filters by kind', async () => {
    await renderWith(<RescueList />, authValue());
    await screen.findByText('Perrito herido junto al mercado');
    jest.mocked(api.listRescueReports).mockResolvedValue({ items: [], page: 1, hasMore: false });
    await fireEvent.press(screen.getByRole('tab', { name: 'Perdidos' }));
    await waitFor(() =>
      expect(api.listRescueReports).toHaveBeenLastCalledWith(
        expect.anything(),
        { kind: 'lost' },
        1,
      ),
    );
    expect(await screen.findByText('No hay casos abiertos de este tipo.')).toBeOnTheScreen();
  });

  it('hides reports by blocked users', async () => {
    jest.mocked(moderationApi.listBlocks).mockResolvedValue([{ id: 'b1', blockedId: 'u2' }]);
    await renderWith(<RescueList />, signedIn());
    expect(await screen.findByText('No hay casos abiertos por ahora.')).toBeOnTheScreen();
  });

  it('sends visitors to sign in to report, and users to the form', async () => {
    await renderWith(<RescueList />, authValue());
    await fireEvent.press(await screen.findByRole('button', { name: 'Reportar un caso' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/sign-in');
    await renderWith(<RescueList />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Reportar un caso' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/rescue/new');
  });
});

describe('reporting', () => {
  it('reports an animal that needs help with the phone location', async () => {
    const saved = report('r9', { reporterId: 'u1' });
    jest.mocked(api.createRescueReport).mockResolvedValue(saved);
    const onSaved = jest.fn();
    await renderWith(<RescueForm onSaved={onSaved} />, signedIn());

    await fireEvent.press(await screen.findByRole('button', { name: 'Publicar reporte' }));
    expect(screen.getByText('Agrega la ubicación.')).toBeOnTheScreen();
    expect(api.createRescueReport).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('radio', { name: 'Necesita ayuda' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Alta' }));
    await fireEvent.changeText(screen.getByLabelText('Descripción'), 'Gatito atrapado');
    await fireEvent.press(screen.getByRole('button', { name: 'Usar mi ubicación actual' }));
    expect(await screen.findByText('Ubicación lista (±12 m).')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Referencia del lugar (opcional)'), 'Parque');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar reporte' }));

    expect(api.createRescueReport).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      expect.objectContaining({
        kind: 'help',
        urgency: 'high',
        description: 'Gatito atrapado',
        place: 'Parque',
        latitude: 19.4326,
        longitude: -99.1332,
        newMedia: [],
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it('explains when the location is not allowed', async () => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      status: 'denied',
    } as never);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderWith(<RescueForm onSaved={jest.fn()} />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Usar mi ubicación actual' }));
    expect(
      await screen.findByText(
        'Pawly no tiene permiso para usar tu ubicación. Actívalo en los ajustes del celular.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir ajustes del celular' }));
    expect(openSettings).toHaveBeenCalled();
  });

  it('reports a lost pet from its profile, with the pet and the date', async () => {
    jest.mocked(api.createRescueReport).mockResolvedValue(report('r9', { kind: 'lost' }));
    await renderWith(<RescueForm kind="lost" petId="p1" onSaved={jest.fn()} />, signedIn());
    expect(await screen.findByRole('radio', { name: 'Luna', checked: true })).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: 'Alta' })).toBeNull();
    await fireEvent.changeText(
      screen.getByLabelText('Fecha en que se vio por última vez'),
      '2026-11-03',
    );
    await fireEvent.changeText(screen.getByLabelText('Descripción'), 'Collar rojo');
    await fireEvent.press(screen.getByRole('button', { name: 'Usar mi ubicación actual' }));
    await screen.findByText('Ubicación lista (±12 m).');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar reporte' }));
    expect(api.createRescueReport).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      expect.objectContaining({ kind: 'lost', petId: 'p1', lastSeenDate: '2026-11-03' }),
    );
  });

  it('shows server errors', async () => {
    jest
      .mocked(api.createRescueReport)
      .mockRejectedValue(serverError(400, { lastSeenAt: { code: 'date_future' } }));
    await renderWith(<RescueForm kind="lost" onSaved={jest.fn()} />, signedIn());
    await fireEvent.changeText(await screen.findByLabelText('Descripción'), 'Se escapó');
    await fireEvent.press(screen.getByRole('button', { name: 'Usar mi ubicación actual' }));
    await screen.findByText('Ubicación lista (±12 m).');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar reporte' }));
    expect(await screen.findByText('Elige una fecha válida.')).toBeOnTheScreen();
  });

  it('edits and deletes a report', async () => {
    const mine = report('r1', { reporterId: 'u1', reporter: TEST_USER });
    jest.mocked(api.updateRescueReport).mockResolvedValue(mine);
    const onSaved = jest.fn();
    const onDeleted = jest.fn();
    await renderWith(
      <RescueForm report={mine} onSaved={onSaved} onDeleted={onDeleted} />,
      signedIn(),
    );
    expect(await screen.findByDisplayValue('Perrito herido junto al mercado')).toBeOnTheScreen();
    expect(screen.getByText('Ubicación guardada.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Descripción'), 'Ya está con un vecino');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(api.updateRescueReport).toHaveBeenCalledWith(
      expect.anything(),
      'r1',
      expect.objectContaining({ description: 'Ya está con un vecino', latitude: 19.35 }),
    );
    expect(onSaved).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Borrar reporte' }));
    expect(api.deleteRescueReport).toHaveBeenCalledWith(expect.anything(), 'r1');
    expect(onDeleted).toHaveBeenCalled();
  });
});

describe('report page', () => {
  it('shows the case, opens the map and lets others write to the reporter', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const onPressUser = jest.fn();
    await renderWith(
      <RescueDetail report={report('r1')} onPressPet={jest.fn()} onPressUser={onPressUser} />,
      signedIn(),
    );
    expect(await screen.findByRole('header', { name: 'Necesita ayuda' })).toBeOnTheScreen();
    expect(screen.getByText('Abierto')).toBeOnTheScreen();
    expect(screen.getByText(/^Urgencia alta · /)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir en mapas' }));
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('19.35,-99.16'));
    await fireEvent.press(screen.getByRole('link', { name: 'Reportado por @sol' }));
    expect(onPressUser).toHaveBeenCalledWith('u2');
    expect(screen.getByRole('button', { name: 'Mensaje' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Marcar como resuelto' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Reportar caso' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/report',
      params: { kind: 'rescue', id: 'r1' },
    });
  });

  it('lets the reporter move the case along', async () => {
    jest.mocked(api.setRescueStatus).mockResolvedValue(report('r1', { status: 'in_progress' }));
    const mine = report('r1', { reporterId: 'u1', reporter: TEST_USER });
    await renderWith(
      <RescueDetail report={mine} onPressPet={jest.fn()} onPressUser={jest.fn()} />,
      signedIn(),
    );
    expect(screen.queryByRole('button', { name: 'Mensaje' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reportar caso' })).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: 'Marcar en curso' }));
    await waitFor(() =>
      expect(api.setRescueStatus).toHaveBeenCalledWith(expect.anything(), 'r1', 'in_progress'),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Marcar como resuelto' }));
    await waitFor(() =>
      expect(api.setRescueStatus).toHaveBeenLastCalledWith(expect.anything(), 'r1', 'closed'),
    );
  });

  it('offers reunited for lost pets and reopening closed cases', async () => {
    const lost = report('r2', {
      kind: 'lost',
      urgency: '',
      reporterId: 'u1',
      lastSeenAt: '2026-11-03 12:00:00.000Z',
    });
    await renderWith(
      <RescueDetail report={lost} onPressPet={jest.fn()} onPressUser={jest.fn()} />,
      signedIn(),
    );
    expect(await screen.findByRole('header', { name: 'Perdido' })).toBeOnTheScreen();
    expect(screen.getByText(/^Visto por última vez el /)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Marcar como reencontrado' })).toBeOnTheScreen();

    await renderWith(
      <RescueDetail
        report={{ ...lost, status: 'closed' }}
        onPressPet={jest.fn()}
        onPressUser={jest.fn()}
      />,
      signedIn(),
    );
    expect(await screen.findByText('Reencontrado')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeOnTheScreen();
  });
});

describe("pet's page", () => {
  it('reports the pet as lost', async () => {
    await renderWith(<PetLostButton pet={LUNA_PET} />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Reportar como perdida' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/rescue/new',
      params: { kind: 'lost', petId: 'p1' },
    });
  });
});
