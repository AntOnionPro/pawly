import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { toUser, type ShelterProfile, type User } from '@/auth/AuthProvider';
import { EditProfileForm } from '@/features/profile/EditProfileForm';
import { ProfileHeader } from '@/features/profile/ProfileHeader';
import { hasShelterInfo } from '@/features/profile/ShelterInfo';
import { PREFERENCES_KEY } from '@/preferences/storage';

import { renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const SHELTER_PROFILE: ShelterProfile = {
  zone: 'Tlalpan, CDMX',
  location: { latitude: 19.2869, longitude: -99.1672 },
  hours: 'Lunes a sábado de 10 a 17 h',
  needs: ['food', 'blankets'],
  needsNote: 'Croquetas para cachorro.',
};
const EMPTY: ShelterProfile = { zone: '', location: null, hours: '', needs: [], needsNote: '' };

const SHELTER: User = {
  ...TEST_USER,
  accountKind: 'shelter',
  publicName: 'Refugio Patitas',
  shelter: SHELTER_PROFILE,
};
const NEW_RESCUER: User = {
  ...TEST_USER,
  accountKind: 'rescuer',
  publicName: 'Rescates Lupita',
  shelter: EMPTY,
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    status: 'granted',
  } as never);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 19.4326, longitude: -99.1332, accuracy: 12.4 },
  } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the shelter or rescuer profile of an account', () => {
  const record = { id: 'u9', collectionId: 'users', collectionName: 'users', username: 'patitas' };
  const fields = {
    zone: 'Tlalpan, CDMX',
    latitude: 19.2869,
    longitude: -99.1672,
    hours: 'Lunes a sábado de 10 a 17 h',
    needs: ['blankets', 'food', 'money'],
    needsNote: 'Croquetas para cachorro.',
  };

  it('comes with a verified account, with its needs in order', () => {
    const user = toUser({ ...record, accountKind: 'shelter', publicName: 'Refugio', ...fields });
    // An unknown need is left out, and the known ones follow the order of the app.
    expect(user?.shelter).toEqual({ ...SHELTER_PROFILE, needs: ['food', 'blankets'] });
  });

  it('has no point when the server stores 0, 0', () => {
    const user = toUser({ ...record, accountKind: 'rescuer', zone: 'Coyoacán' });
    expect(user?.shelter).toEqual({ ...EMPTY, zone: 'Coyoacán' });
  });

  it('is not there on a regular account', () => {
    expect(toUser({ ...record, ...fields })?.shelter).toBeUndefined();
  });

  it('counts as filled in with any of its parts', () => {
    expect(hasShelterInfo(undefined)).toBe(false);
    expect(hasShelterInfo(EMPTY)).toBe(false);
    expect(hasShelterInfo({ ...EMPTY, hours: '10 a 17 h' })).toBe(true);
    expect(hasShelterInfo({ ...EMPTY, needs: ['foster'] })).toBe(true);
    expect(hasShelterInfo({ ...EMPTY, location: { latitude: 19, longitude: -99 } })).toBe(true);
  });
});

describe('editing the profile', () => {
  it('does not ask a regular account about it', async () => {
    const auth = signedIn();
    await renderWith(<EditProfileForm user={TEST_USER} onSaved={jest.fn()} />, auth);
    await screen.findByLabelText('Nombre de usuario');
    expect(screen.queryByText('Perfil de refugio')).toBeNull();
    expect(screen.queryByLabelText('Zona o dirección')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(jest.mocked(auth.updateProfile).mock.calls[0]?.[0]).not.toHaveProperty('shelter');
  });

  it('lets a verified account say where it is, when it attends and what it needs', async () => {
    const auth = signedIn({ user: NEW_RESCUER });
    const onSaved = jest.fn();
    await renderWith(<EditProfileForm user={NEW_RESCUER} onSaved={onSaved} />, auth);
    expect(await screen.findByRole('header', { name: 'Perfil de rescatista' })).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Zona o dirección'), 'Coyoacán, CDMX');
    await fireEvent.press(screen.getByRole('button', { name: 'Usar mi ubicación actual' }));
    expect(await screen.findByText('Ubicación lista (±12 m).')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Horarios'), 'Fines de semana');
    // Several needs at once, and a second tap takes one back.
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Voluntarios' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Alimento' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Transporte' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Transporte' }));
    expect(screen.getByRole('checkbox', { name: 'Alimento', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Transporte', checked: false })).toBeOnTheScreen();
    await fireEvent.changeText(
      screen.getByLabelText('Detalles de lo que necesitas (opcional)'),
      'Croquetas y paseos.',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(auth.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        shelter: {
          zone: 'Coyoacán, CDMX',
          location: { latitude: 19.4326, longitude: -99.1332 },
          hours: 'Fines de semana',
          needs: ['food', 'volunteers'],
          needsNote: 'Croquetas y paseos.',
        },
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('starts from what is saved, and the point can be taken off', async () => {
    const auth = signedIn({ user: SHELTER });
    await renderWith(<EditProfileForm user={SHELTER} onSaved={jest.fn()} />, auth);
    expect(await screen.findByRole('header', { name: 'Perfil de refugio' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Zona o dirección').props.value).toBe('Tlalpan, CDMX');
    expect(screen.getByRole('checkbox', { name: 'Cobijas', checked: true })).toBeOnTheScreen();
    expect(screen.getByText('Ubicación guardada.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Quitar ubicación' }));
    expect(screen.queryByText('Ubicación guardada.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quitar ubicación' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(auth.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ shelter: { ...SHELTER_PROFILE, location: null } }),
    );
  });

  it('shows what the server says about the profile', async () => {
    const auth = signedIn({
      user: SHELTER,
      updateProfile: jest.fn().mockRejectedValue(
        serverError(400, {
          needsNote: { code: 'content_blocked' },
          latitude: { code: 'location_required' },
        }),
      ),
    });
    await renderWith(<EditProfileForm user={SHELTER} onSaved={jest.fn()} />, auth);
    await fireEvent.press(await screen.findByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('Tu texto tiene palabras que no se permiten en Pawly.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Agrega la ubicación.')).toBeOnTheScreen();
  });
});

describe('profile of a shelter or rescuer', () => {
  it('shows where it is, when it attends and what it needs, and opens the maps', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderWith(<ProfileHeader user={SHELTER} />, signedIn());
    expect(await screen.findByLabelText('Zona: Tlalpan, CDMX')).toBeOnTheScreen();
    expect(screen.getByLabelText('Horarios: Lunes a sábado de 10 a 17 h')).toBeOnTheScreen();
    expect(screen.getByText('Necesita')).toBeOnTheScreen();
    expect(screen.getByText('Alimento')).toBeOnTheScreen();
    expect(screen.getByText('Cobijas')).toBeOnTheScreen();
    expect(screen.queryByText('Voluntarios')).toBeNull();
    expect(screen.getByText('Croquetas para cachorro.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Abrir en mapas' }));
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('19.2869,-99.1672'));
  });

  it('shows only what was filled in', async () => {
    const user: User = { ...SHELTER, shelter: { ...EMPTY, zone: 'Coyoacán' } };
    await renderWith(<ProfileHeader user={user} />, signedIn());
    expect(await screen.findByLabelText('Zona: Coyoacán')).toBeOnTheScreen();
    // Without a point there is nothing to open, and no empty headings.
    expect(screen.queryByRole('button', { name: 'Abrir en mapas' })).toBeNull();
    expect(screen.queryByText('Necesita')).toBeNull();
    expect(screen.queryByLabelText(/^Horarios: /)).toBeNull();
  });

  it('shows nothing when it is empty, or on a regular account', async () => {
    const view = await renderWith(<ProfileHeader user={NEW_RESCUER} />, signedIn());
    await screen.findByLabelText('Rescatista verificado');
    expect(screen.queryByTestId('shelter-info')).toBeNull();
    await view.unmount();

    // A profile that was left behind does not show without the verification.
    const regular: User = { ...TEST_USER, shelter: SHELTER_PROFILE };
    await renderWith(<ProfileHeader user={regular} />, signedIn());
    await screen.findByRole('header', { name: '@luna' });
    expect(screen.queryByTestId('shelter-info')).toBeNull();
  });
});
