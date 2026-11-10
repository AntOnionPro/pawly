import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import type PocketBase from 'pocketbase';

import { toUser, type User } from '@/auth/AuthProvider';
import { ProfileHeader } from '@/features/profile/ProfileHeader';
import * as api from '@/features/verification/api';
import { pickDocuments } from '@/features/verification/documents';
import { VerificationContent } from '@/features/verification/VerificationContent';
import { validateVerification } from '@/features/verification/VerificationForm';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { confirm } from '@/utils/confirm';

import { renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
jest.mock('@/features/verification/api', () => ({
  ...jest.requireActual('@/features/verification/api'),
  getLatestVerification: jest.fn(),
  sendVerification: jest.fn(),
  cancelVerification: jest.fn(),
}));

const MB = 1024 * 1024;

function request(overrides: Partial<api.VerificationRequest> = {}): api.VerificationRequest {
  return {
    id: 'v1',
    kind: 'rescuer',
    publicName: 'Rescates Lupita',
    about: 'Rescato perros en Coyoacán.',
    links: 'instagram.com/rescateslupita',
    documents: [],
    status: 'pending',
    reviewNote: '',
    created: new Date().toISOString(),
    ...overrides,
  };
}

const SHELTER: User = { ...TEST_USER, accountKind: 'shelter', publicName: 'Refugio Patitas' };

function picked(...assets: Partial<DocumentPicker.DocumentPickerAsset>[]) {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
    canceled: false,
    assets: assets.map((asset, index) => ({
      uri: `file:///docs/${index}`,
      name: `archivo${index}.pdf`,
      mimeType: 'application/pdf',
      size: 1000,
      lastModified: 0,
      ...asset,
    })),
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(api.getLatestVerification).mockResolvedValue(null);
  jest.mocked(api.sendVerification).mockResolvedValue(request());
  jest.mocked(api.cancelVerification).mockResolvedValue(undefined);
  jest.mocked(confirm).mockResolvedValue(true);
});

describe('verification API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/verification/api');

  it('maps a request, and an account with its kind and public name', () => {
    const mapped = actual.toVerificationRequest({
      id: 'v1',
      collectionId: 'verification_requests',
      collectionName: 'verification_requests',
      kind: 'shelter',
      publicName: 'Refugio Patitas',
      about: 'Refugio en Tlalpan',
      documents: ['acta_abc.pdf'],
      status: 'rejected',
      reviewNote: 'Falta la constancia',
    });
    expect(mapped).toMatchObject({
      kind: 'shelter',
      status: 'rejected',
      documents: ['acta_abc.pdf'],
      reviewNote: 'Falta la constancia',
      links: '',
    });

    const record = {
      id: 'u9',
      collectionId: 'users',
      collectionName: 'users',
      username: 'patitas',
    };
    expect(
      toUser({ ...record, accountKind: 'shelter', publicName: 'Refugio Patitas' }),
    ).toMatchObject({ accountKind: 'shelter', publicName: 'Refugio Patitas' });
    // Anything else is a regular account.
    expect(toUser({ ...record, accountKind: 'clinic' })).toMatchObject({
      accountKind: '',
      publicName: '',
    });
  });

  it('asks for the newest request of the account', async () => {
    const getList = jest.fn().mockResolvedValue({ items: [] });
    const client = {
      collection: () => ({ getList }),
      filter: (raw: string, params: Record<string, string>) => `${raw}|${params.user}`,
    } as unknown as PocketBase;
    expect(await actual.getLatestVerification(client, 'u1')).toBeNull();
    expect(getList).toHaveBeenCalledWith(
      1,
      1,
      expect.objectContaining({ filter: 'user = {:user}|u1', sort: '-created,-id' }),
    );
  });

  it('sends the documents only for a shelter', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'v1', collectionId: 'c' });
    const client = { collection: () => ({ create }) } as unknown as PocketBase;
    const document = { uri: 'file:///acta.pdf', name: 'acta.pdf', type: 'application/pdf' };
    const values = {
      kind: 'shelter' as const,
      publicName: ' Refugio Patitas ',
      about: ' Refugio en Tlalpan ',
      links: '',
      documents: [document],
    };
    await actual.sendVerification(client, 'u1', values);
    const form = create.mock.calls[0]?.[0] as FormData;
    expect(form.get('user')).toBe('u1');
    expect(form.get('kind')).toBe('shelter');
    expect(form.get('publicName')).toBe('Refugio Patitas');
    expect(form.get('about')).toBe('Refugio en Tlalpan');
    expect(form.getAll('documents')).toHaveLength(1);

    await actual.sendVerification(client, 'u1', { ...values, kind: 'rescuer' });
    expect((create.mock.calls[1]?.[0] as FormData).getAll('documents')).toHaveLength(0);
  });

  it('validates the form', () => {
    const empty = { kind: '' as const, publicName: ' ', about: '', links: '', documents: [] };
    expect(validateVerification(empty)).toEqual({
      kind: 'errors.required',
      publicName: 'errors.required',
      about: 'errors.required',
    });
    expect(
      validateVerification({ ...empty, kind: 'shelter', publicName: 'Ab', about: 'Refugio' }),
    ).toEqual({ publicName: 'errors.nameTooShort', documents: 'errors.documentsRequired' });
    expect(
      validateVerification({ ...empty, kind: 'rescuer', publicName: 'Lupita', about: 'Rescato' }),
    ).toEqual({});
  });
});

describe('choosing documents', () => {
  it('keeps PDFs and photos up to 10 MB, and says why it left others out', async () => {
    picked(
      { name: 'acta.pdf' },
      { name: 'constancia.JPG', mimeType: undefined },
      { name: 'nota.docx', mimeType: 'application/msword' },
      { name: 'enorme.pdf', size: 11 * MB },
    );
    const result = await pickDocuments(5);
    expect(result.files).toEqual([
      { uri: 'file:///docs/0', name: 'acta.pdf', type: 'application/pdf' },
      { uri: 'file:///docs/1', name: 'constancia.JPG', type: 'image/jpeg' },
    ]);
    expect(result.errors).toEqual(['errors.documentType', 'errors.documentTooLarge']);
  });

  it('takes only as many as fit, and nothing when the picker is closed', async () => {
    picked({ name: 'a.pdf' }, { name: 'b.pdf' }, { name: 'c.pdf' });
    expect((await pickDocuments(2)).files).toHaveLength(2);
    jest
      .mocked(DocumentPicker.getDocumentAsync)
      .mockResolvedValue({ canceled: true, assets: null });
    expect(await pickDocuments(5)).toEqual({ files: [], errors: [] });
  });
});

describe('asking for a shelter or rescuer account', () => {
  it('sends a rescuer request and shows it in review', async () => {
    await renderWith(<VerificationContent />, signedIn());
    expect(await screen.findByText(/^Los refugios y rescatistas verificados/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(screen.getAllByText('Este campo es obligatorio.').length).toBe(3);
    expect(api.sendVerification).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('radio', { name: 'Rescatista independiente' }));
    // Only a shelter is asked for documents.
    expect(screen.queryByText('Documentos')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Nombre público'), 'Rescates Lupita');
    await fireEvent.changeText(screen.getByLabelText('A qué te dedicas'), 'Rescato perros.');
    await fireEvent.changeText(screen.getByLabelText('Enlaces (opcional)'), 'instagram.com/lupita');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));

    expect(api.sendVerification).toHaveBeenCalledWith(expect.anything(), 'u1', {
      kind: 'rescuer',
      publicName: 'Rescates Lupita',
      about: 'Rescato perros.',
      links: 'instagram.com/lupita',
      documents: [],
    });
    expect(await screen.findByRole('header', { name: 'En revisión' })).toBeOnTheScreen();
    expect(
      screen.getByText(/como rescatista independiente, con el nombre "Rescates Lupita"/),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Enviar' })).toBeNull();
  });

  it('asks a shelter for its documents', async () => {
    jest
      .mocked(api.sendVerification)
      .mockResolvedValue(request({ kind: 'shelter', documents: ['a.pdf', 'b.pdf'] }));
    await renderWith(<VerificationContent />, signedIn());
    await fireEvent.press(await screen.findByRole('radio', { name: 'Refugio constituido' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre público'), 'Refugio Patitas');
    await fireEvent.changeText(screen.getByLabelText('A qué te dedicas'), 'Refugio en Tlalpan.');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(screen.getByText('Agrega los documentos del refugio.')).toBeOnTheScreen();

    picked(
      { name: 'acta.pdf' },
      { name: 'constancia.pdf' },
      { name: 'nota.txt', mimeType: 'text/plain' },
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar documentos' }));
    expect(await screen.findByText('acta.pdf')).toBeOnTheScreen();
    expect(screen.getByText('constancia.pdf')).toBeOnTheScreen();
    expect(
      screen.getByText('Solo se permiten documentos en PDF o foto (JPEG, PNG, WebP, HEIC).'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Agrega los documentos del refugio.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar constancia.pdf' }));
    expect(screen.queryByText('constancia.pdf')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(api.sendVerification).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      expect.objectContaining({
        kind: 'shelter',
        documents: [{ uri: 'file:///docs/0', name: 'acta.pdf', type: 'application/pdf' }],
      }),
    );
    expect(await screen.findByText('Enviaste 2 documentos.')).toBeOnTheScreen();
  });

  it('shows what the server says', async () => {
    jest
      .mocked(api.sendVerification)
      .mockRejectedValue(serverError(400, { user: { code: 'already_pending' } }));
    await renderWith(<VerificationContent />, signedIn());
    await fireEvent.press(await screen.findByRole('radio', { name: 'Rescatista independiente' }));
    await fireEvent.changeText(screen.getByLabelText('Nombre público'), 'Rescates Lupita');
    await fireEvent.changeText(screen.getByLabelText('A qué te dedicas'), 'Rescato perros.');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Ya tienes una solicitud en revisión.')).toBeOnTheScreen();
    // What was written stays.
    expect(screen.getByLabelText('Nombre público').props.value).toBe('Rescates Lupita');
  });
});

describe('the state of a request', () => {
  it('lets the person cancel a request in review', async () => {
    jest.mocked(api.getLatestVerification).mockResolvedValue(request());
    await renderWith(<VerificationContent />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancelar solicitud' }));
    expect(confirm).toHaveBeenCalled();
    await waitFor(() =>
      expect(api.cancelVerification).toHaveBeenCalledWith(expect.anything(), 'v1'),
    );
  });

  it('keeps the request when the person does not confirm', async () => {
    jest.mocked(confirm).mockResolvedValue(false);
    jest.mocked(api.getLatestVerification).mockResolvedValue(request());
    await renderWith(<VerificationContent />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancelar solicitud' }));
    expect(api.cancelVerification).not.toHaveBeenCalled();
  });

  it('says why a request was rejected and starts the form from it', async () => {
    jest
      .mocked(api.getLatestVerification)
      .mockResolvedValue(request({ status: 'rejected', reviewNote: 'Los enlaces no abren.' }));
    await renderWith(<VerificationContent />, signedIn());
    expect(
      await screen.findByRole('header', { name: 'No aprobamos tu solicitud' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Motivo: Los enlaces no abren.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Nombre público').props.value).toBe('Rescates Lupita');
    expect(
      screen.getByRole('radio', { name: 'Rescatista independiente', checked: true }),
    ).toBeOnTheScreen();
  });

  it('shows a verified account, which can ask for a change', async () => {
    jest
      .mocked(api.getLatestVerification)
      .mockResolvedValue(
        request({ kind: 'shelter', publicName: 'Refugio Patitas', status: 'approved' }),
      );
    await renderWith(<VerificationContent />, signedIn({ user: SHELTER }));
    expect(await screen.findByLabelText('Refugio verificado')).toBeOnTheScreen();
    expect(screen.getByText('Refugio Patitas')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Enviar' })).toBeNull();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Pedir un cambio de nombre o de tipo' }),
    );
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Nombre público').props.value).toBe('');
  });

  it('says when the verification was taken back', async () => {
    jest
      .mocked(api.getLatestVerification)
      .mockResolvedValue(request({ status: 'revoked', reviewNote: 'Reportes de fraude.' }));
    await renderWith(<VerificationContent />, signedIn());
    expect(
      await screen.findByRole('header', { name: 'Retiramos la verificación de tu cuenta' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Motivo: Reportes de fraude.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeOnTheScreen();
  });

  it('brings the session up to date after a review', async () => {
    const authRefresh = jest.fn().mockResolvedValue({});
    const client = { collection: () => ({ authRefresh }) } as unknown as PocketBase;
    jest.mocked(api.getLatestVerification).mockResolvedValue(request({ status: 'approved' }));
    // The request was approved, but this session still has a regular account.
    await renderWith(<VerificationContent />, signedIn({ client }));
    await waitFor(() => expect(authRefresh).toHaveBeenCalledTimes(1));
  });

  it('does not refresh a session that is already up to date', async () => {
    const authRefresh = jest.fn().mockResolvedValue({});
    const client = { collection: () => ({ authRefresh }) } as unknown as PocketBase;
    jest
      .mocked(api.getLatestVerification)
      .mockResolvedValue(
        request({ kind: 'shelter', publicName: 'Refugio Patitas', status: 'approved' }),
      );
    await renderWith(<VerificationContent />, signedIn({ client, user: SHELTER }));
    await screen.findByLabelText('Refugio verificado');
    expect(authRefresh).not.toHaveBeenCalled();
  });
});

describe('profile of a verified account', () => {
  it('shows the public name, the username and the badge', async () => {
    await renderWith(<ProfileHeader user={SHELTER} />, signedIn());
    expect(await screen.findByRole('header', { name: 'Refugio Patitas' })).toBeOnTheScreen();
    expect(screen.getByText('@luna')).toBeOnTheScreen();
    expect(screen.getByLabelText('Refugio verificado')).toBeOnTheScreen();
  });

  it('shows a rescuer as such, and no badge on a regular account', async () => {
    const rescuer: User = { ...TEST_USER, accountKind: 'rescuer', publicName: 'Rescates Lupita' };
    const view = await renderWith(<ProfileHeader user={rescuer} />, signedIn());
    expect(await screen.findByLabelText('Rescatista verificado')).toBeOnTheScreen();
    await view.unmount();

    await renderWith(<ProfileHeader user={TEST_USER} />, signedIn());
    expect(await screen.findByRole('header', { name: '@luna' })).toBeOnTheScreen();
    expect(screen.queryByTestId(/^verified-badge-/)).toBeNull();
  });
});
