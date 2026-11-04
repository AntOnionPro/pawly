import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { DeleteAccountForm } from '@/features/account/DeleteAccountForm';
import { EditProfileForm } from '@/features/profile/EditProfileForm';
import { ProfileHeader } from '@/features/profile/ProfileHeader';
import { SettingsContent } from '@/features/settings/SettingsContent';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { confirm } from '@/utils/confirm';

import { renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));

const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(confirm).mockResolvedValue(true);
});

describe('ProfileHeader', () => {
  it('shows the username and the bio', async () => {
    await renderWith(<ProfileHeader user={TEST_USER} />, signedIn());
    expect(await screen.findByText('@luna')).toBeOnTheScreen();
    expect(screen.getByText('Tengo una perrita.')).toBeOnTheScreen();
  });
});

describe('EditProfileForm', () => {
  it('saves the username and the bio', async () => {
    const auth = signedIn();
    const onSaved = jest.fn();
    await renderWith(<EditProfileForm user={TEST_USER} onSaved={onSaved} />, auth);
    await screen.findByLabelText('Nombre de usuario');
    await type('Nombre de usuario', 'Luna.MX');
    await type('Bio', 'Rescatista de gatos.');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(auth.updateProfile).toHaveBeenCalledWith({
      username: 'luna.mx',
      bio: 'Rescatista de gatos.',
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('uploads a new photo picked from the gallery', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///foto.jpg',
          fileName: 'foto.jpg',
          mimeType: 'image/jpeg',
          width: 400,
          height: 400,
        },
      ],
    });
    const auth = signedIn();
    await renderWith(<EditProfileForm user={TEST_USER} onSaved={jest.fn()} />, auth);
    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar foto' }));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(auth.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar: { uri: 'file:///foto.jpg', name: 'foto.jpg', type: 'image/jpeg' },
      }),
    );
  });

  it('removes the current photo', async () => {
    const auth = signedIn();
    await renderWith(
      <EditProfileForm user={{ ...TEST_USER, avatar: 'foto.jpg' }} onSaved={jest.fn()} />,
      auth,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Quitar foto' }));
    expect(screen.getByRole('button', { name: 'Agregar foto' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(auth.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ avatar: null }));
  });

  it('validates the username and shows server errors', async () => {
    const auth = signedIn({
      updateProfile: jest
        .fn()
        .mockRejectedValue(serverError(400, { username: { code: 'validation_not_unique' } })),
    });
    await renderWith(<EditProfileForm user={TEST_USER} onSaved={jest.fn()} />, auth);
    await screen.findByLabelText('Nombre de usuario');
    await type('Nombre de usuario', 'a b');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      screen.getByText('Usa de 3 a 30 caracteres: minúsculas, números, punto y guion bajo.'),
    ).toBeOnTheScreen();
    expect(auth.updateProfile).not.toHaveBeenCalled();

    await type('Nombre de usuario', 'firulais');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText('Ese nombre de usuario ya está en uso.')).toBeOnTheScreen();
  });
});

describe('ChangePasswordForm', () => {
  async function fill(current: string, next: string, again: string) {
    await type('Contraseña actual', current);
    await type('Nueva contraseña', next);
    await type('Confirma la nueva contraseña', again);
    await fireEvent.press(screen.getByRole('button', { name: 'Cambiar contraseña' }));
  }

  it('changes the password', async () => {
    const auth = signedIn();
    const onChanged = jest.fn();
    await renderWith(<ChangePasswordForm onChanged={onChanged} />, auth);
    await screen.findByLabelText('Contraseña actual');
    await fill('vieja-clave-1', 'nueva-clave-2', 'nueva-clave-2');
    expect(auth.changePassword).toHaveBeenCalledWith(
      'vieja-clave-1',
      'nueva-clave-2',
      'nueva-clave-2',
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it('checks the new password before calling the server', async () => {
    const auth = signedIn();
    await renderWith(<ChangePasswordForm onChanged={jest.fn()} />, auth);
    await screen.findByLabelText('Contraseña actual');
    await fill('vieja-clave-1', 'corta', 'otra');
    expect(screen.getByText('Usa al menos 8 caracteres.')).toBeOnTheScreen();
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeOnTheScreen();
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('explains a wrong current password', async () => {
    const auth = signedIn({
      changePassword: jest
        .fn()
        .mockRejectedValue(
          serverError(400, { oldPassword: { code: 'validation_invalid_old_password' } }),
        ),
    });
    await renderWith(<ChangePasswordForm onChanged={jest.fn()} />, auth);
    await screen.findByLabelText('Contraseña actual');
    await fill('equivocada', 'nueva-clave-2', 'nueva-clave-2');
    expect(screen.getByText('La contraseña actual no es correcta.')).toBeOnTheScreen();
  });
});

describe('DeleteAccountForm', () => {
  const understand = 'Entiendo que mi cuenta no se puede recuperar';

  it('needs the password and the confirmation checkbox', async () => {
    const auth = signedIn();
    await renderWith(<DeleteAccountForm onDeleted={jest.fn()} />, auth);
    await fireEvent.press(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }));
    expect(screen.getByText('Este campo es obligatorio.')).toBeOnTheScreen();
    await type('Contraseña actual', 'mi-clave-123');
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
    expect(
      screen.getByText('Confirma que entiendes que la cuenta no se puede recuperar.'),
    ).toBeOnTheScreen();
    expect(confirm).not.toHaveBeenCalled();
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('asks once more and deletes the account', async () => {
    const auth = signedIn();
    const onDeleted = jest.fn();
    await renderWith(<DeleteAccountForm onDeleted={onDeleted} />, auth);
    await screen.findByLabelText('Contraseña actual');
    await type('Contraseña actual', 'mi-clave-123');
    await fireEvent.press(screen.getByRole('checkbox', { name: understand }));
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    expect(auth.deleteAccount).toHaveBeenCalledWith('mi-clave-123');
    expect(onDeleted).toHaveBeenCalled();
  });

  it('does nothing if the final confirmation is cancelled', async () => {
    jest.mocked(confirm).mockResolvedValue(false);
    const auth = signedIn();
    await renderWith(<DeleteAccountForm onDeleted={jest.fn()} />, auth);
    await screen.findByLabelText('Contraseña actual');
    await type('Contraseña actual', 'mi-clave-123');
    await fireEvent.press(screen.getByRole('checkbox', { name: understand }));
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('explains a wrong password', async () => {
    const auth = signedIn({ deleteAccount: jest.fn().mockRejectedValue(serverError(400)) });
    await renderWith(<DeleteAccountForm onDeleted={jest.fn()} />, auth);
    await screen.findByLabelText('Contraseña actual');
    await type('Contraseña actual', 'equivocada');
    await fireEvent.press(screen.getByRole('checkbox', { name: understand }));
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
    expect(screen.getByText('La contraseña actual no es correcta.')).toBeOnTheScreen();
  });
});

describe('SettingsContent account section', () => {
  it('is only shown with a session and runs each action', async () => {
    const account = {
      onChangePassword: jest.fn(),
      onSignOut: jest.fn(),
      onDeleteAccount: jest.fn(),
    };
    await renderWith(<SettingsContent account={account} />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Cambiar contraseña' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar cuenta' }));
    expect(account.onChangePassword).toHaveBeenCalled();
    expect(account.onSignOut).toHaveBeenCalled();
    expect(account.onDeleteAccount).toHaveBeenCalled();
  });

  it('is hidden for visitors', async () => {
    await renderWith(<SettingsContent />);
    await screen.findByText('Tema');
    expect(screen.queryByText('Cuenta')).toBeNull();
  });
});
