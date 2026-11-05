import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';

import { ForgotPasswordForm } from '@/features/auth/ForgotPasswordForm';
import { SignInForm } from '@/features/auth/SignInForm';
import { SignUpForm } from '@/features/auth/SignUpForm';
import { PREFERENCES_KEY } from '@/preferences/storage';

import { authValue, renderWith, serverError } from '../test-utils/render';

// The native date picker cannot be driven in tests: a text field stands in for it.
jest.mock('@/components/DateField', () => {
  const { Text, TextInput, View } = jest.requireActual('react-native');
  return {
    DateField: ({
      label,
      value,
      onChange,
      error,
    }: {
      label: string;
      value: string;
      onChange: (v: string) => void;
      error?: string | null;
    }) => (
      <View>
        <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} />
        {error ? <Text>{error}</Text> : null}
      </View>
    ),
  };
});

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));

const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
});

describe('SignUpForm', () => {
  const props = () => ({ onSignedUp: jest.fn(), onSignIn: jest.fn(), onOpenLegal: jest.fn() });

  it('shows what is missing and does not call the server', async () => {
    const auth = authValue();
    await renderWith(<SignUpForm {...props()} />, auth);
    await fireEvent.press(await screen.findByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getAllByText('Este campo es obligatorio.').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('Elige tu fecha de nacimiento.')).toBeOnTheScreen();
    expect(
      screen.getByText('Acepta los términos de servicio y el aviso de privacidad para continuar.'),
    ).toBeOnTheScreen();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('opens the legal documents', async () => {
    const handlers = props();
    await renderWith(<SignUpForm {...handlers} />, authValue());
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Leer el aviso de privacidad' }),
    );
    expect(handlers.onOpenLegal).toHaveBeenCalledWith('privacy');
  });

  it('lowercases the username as it is typed', async () => {
    await renderWith(<SignUpForm {...props()} />, authValue());
    await type('Nombre de usuario', 'Firulais');
    expect(screen.getByLabelText('Nombre de usuario').props.value).toBe('firulais');
  });

  async function fillValidForm() {
    await type('Nombre de usuario', 'luna');
    await type('Correo', 'luna@ejemplo.com');
    await type('Contraseña', '12345678');
    await type('Confirma la contraseña', '12345678');
    await type('Fecha de nacimiento', '1995-03-02');
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Acepto los términos de servicio y el aviso de privacidad',
      }),
    );
  }

  it('creates the account and continues to "check your email"', async () => {
    const auth = authValue();
    const handlers = props();
    await renderWith(<SignUpForm {...handlers} />, auth);
    await screen.findByLabelText('Nombre de usuario');
    await fillValidForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(auth.signUp).toHaveBeenCalledWith({
      username: 'luna',
      email: 'luna@ejemplo.com',
      password: '12345678',
      passwordConfirm: '12345678',
      dateOfBirth: '1995-03-02',
      acceptTerms: true,
    });
    expect(handlers.onSignedUp).toHaveBeenCalledWith('luna@ejemplo.com');
  });

  it('rejects people younger than 13 before calling the server', async () => {
    const auth = authValue();
    await renderWith(<SignUpForm {...props()} />, auth);
    await screen.findByLabelText('Nombre de usuario');
    await fillValidForm();
    await type('Fecha de nacimiento', `${new Date().getFullYear() - 5}-01-01`);
    await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getByText('Debes tener al menos 13 años para usar Pawly.')).toBeOnTheScreen();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('shows server errors on their fields', async () => {
    const auth = authValue({
      signUp: jest.fn().mockRejectedValue(
        serverError(400, {
          username: { code: 'validation_not_unique' },
          email: { code: 'validation_not_unique' },
        }),
      ),
    });
    const handlers = props();
    await renderWith(<SignUpForm {...handlers} />, auth);
    await screen.findByLabelText('Nombre de usuario');
    await fillValidForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(screen.getByText('Ese nombre de usuario ya está en uso.')).toBeOnTheScreen();
    expect(screen.getByText('Ya existe una cuenta con ese correo.')).toBeOnTheScreen();
    expect(handlers.onSignedUp).not.toHaveBeenCalled();
  });
});

describe('SignInForm', () => {
  const props = () => ({ onSignedIn: jest.fn(), onForgotPassword: jest.fn(), onSignUp: jest.fn() });

  async function submit(email: string, password: string) {
    await type('Correo', email);
    await type('Contraseña', password);
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
  }

  it('signs in and continues', async () => {
    const auth = authValue();
    const handlers = props();
    await renderWith(<SignInForm {...handlers} />, auth);
    await screen.findByLabelText('Correo');
    await submit('luna@ejemplo.com', '12345678');
    expect(auth.signIn).toHaveBeenCalledWith('luna@ejemplo.com', '12345678');
    expect(handlers.onSignedIn).toHaveBeenCalled();
  });

  it('explains a wrong password', async () => {
    const auth = authValue({ signIn: jest.fn().mockRejectedValue(serverError(400)) });
    await renderWith(<SignInForm {...props()} />, auth);
    await screen.findByLabelText('Correo');
    await submit('luna@ejemplo.com', 'incorrecta');
    expect(screen.getByText('Correo o contraseña incorrectos.')).toBeOnTheScreen();
  });

  it('offers to resend the email when the account is not verified', async () => {
    const auth = authValue({ signIn: jest.fn().mockRejectedValue(serverError(403)) });
    await renderWith(<SignInForm {...props()} />, auth);
    await screen.findByLabelText('Correo');
    await submit('luna@ejemplo.com', '12345678');
    expect(
      screen.getByText('Tu correo aún no está verificado. Abre el enlace que te enviamos.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reenviar correo de verificación' }));
    expect(auth.requestVerification).toHaveBeenCalledWith('luna@ejemplo.com');
    expect(screen.getByText('Te enviamos un nuevo enlace de verificación.')).toBeOnTheScreen();
  });

  it('explains when the server cannot be reached', async () => {
    const auth = authValue({ signIn: jest.fn().mockRejectedValue(serverError(0)) });
    await renderWith(<SignInForm {...props()} />, auth);
    await screen.findByLabelText('Correo');
    await submit('luna@ejemplo.com', '12345678');
    expect(
      screen.getByText(
        'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      ),
    ).toBeOnTheScreen();
  });
});

describe('ForgotPasswordForm', () => {
  it('sends the link and gives the same answer for any email', async () => {
    const auth = authValue();
    await renderWith(<ForgotPasswordForm />, auth);
    await type('Correo', 'luna@ejemplo.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(auth.requestPasswordReset).toHaveBeenCalledWith('luna@ejemplo.com');
    expect(
      screen.getByText(
        'Si existe una cuenta para luna@ejemplo.com, recibirás un enlace en unos minutos.',
      ),
    ).toBeOnTheScreen();
  });

  it('validates the email first', async () => {
    const auth = authValue();
    await renderWith(<ForgotPasswordForm />, auth);
    await type('Correo', 'no-es-correo');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(screen.getByText('Escribe un correo válido.')).toBeOnTheScreen();
    expect(auth.requestPasswordReset).not.toHaveBeenCalled();
  });
});
