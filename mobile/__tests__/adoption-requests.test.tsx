import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import type PocketBase from 'pocketbase';

import type { Adoption } from '@/features/adoption/api';
import { RequestForm } from '@/features/adoption/RequestForm';
import { RequestList } from '@/features/adoption/RequestList';
import * as api from '@/features/adoption/requests';
import { RequestSection } from '@/features/adoption/RequestSection';
import { SentRequests } from '@/features/adoption/SentRequests';
import * as messagesApi from '@/features/messages/api';
import * as moderationApi from '@/features/moderation/api';
import * as notificationsApi from '@/features/notifications/api';
import { NotificationList } from '@/features/notifications/NotificationList';
import { usePushTaps } from '@/features/push/hooks';
import type { Pet } from '@/features/pets/api';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { confirm } from '@/utils/confirm';

import { authValue, renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
jest.mock('@/features/adoption/requests', () => ({
  ...jest.requireActual('@/features/adoption/requests'),
  getMyRequest: jest.fn(),
  listAdoptionRequests: jest.fn(),
  countPendingRequests: jest.fn(),
  listSentRequests: jest.fn(),
  sendAdoptionRequest: jest.fn(),
  setRequestStatus: jest.fn(),
}));
jest.mock('@/features/messages/api', () => ({
  ...jest.requireActual('@/features/messages/api'),
  openConversation: jest.fn(),
}));
jest.mock('@/features/moderation/api', () => ({
  ...jest.requireActual('@/features/moderation/api'),
  listBlocks: jest.fn(),
}));
jest.mock('@/features/notifications/api', () => ({
  ...jest.requireActual('@/features/notifications/api'),
  listNotifications: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));

const mockRouter = { push: jest.fn() };

const SOL = { ...TEST_USER, id: 'u2', username: 'sol', bio: '' };
const ROCCO = { ...TEST_USER, id: 'u3', username: 'rocco', bio: '' };

const FIRULAIS: Pet = {
  id: 'p1',
  collectionId: 'pets',
  ownerId: 'u2',
  name: 'Firulais',
  species: 'dog',
  breed: '',
  birthDate: '',
  photo: '',
  previousOwnerId: '',
  adoptedAt: '',
};

const LISTING: Adoption = {
  id: 'a1',
  collectionId: 'adoptions',
  publisherId: 'u2',
  publisher: SOL,
  petId: 'p1',
  pet: FIRULAIS,
  sex: 'male',
  size: 'medium',
  vaccines: 'complete',
  sterilized: true,
  health: '',
  zone: 'Coyoacán, CDMX',
  requirements: '',
  description: '',
  media: [],
  status: 'available',
  adopterId: '',
  adoptedAt: '',
  created: new Date().toISOString(),
};

function request(
  id: string,
  status: api.RequestStatus,
  overrides: Partial<api.AdoptionRequest> = {},
): api.AdoptionRequest {
  return {
    id,
    adoptionId: 'a1',
    applicantId: 'u1',
    applicant: TEST_USER,
    message: 'Tengo patio y mucho tiempo.',
    status,
    created: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(moderationApi.listBlocks).mockResolvedValue([]);
  jest.mocked(api.getMyRequest).mockResolvedValue(null);
  jest.mocked(api.countPendingRequests).mockResolvedValue(0);
  jest.mocked(confirm).mockResolvedValue(true);
});

describe('request API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/adoption/requests');

  it('maps a request with its listing and applicant', () => {
    const mapped = actual.toAdoptionRequest({
      id: 'r1',
      collectionId: 'adoption_requests',
      collectionName: 'adoption_requests',
      adoption: 'a1',
      applicant: 'u1',
      message: 'Hola',
      status: 'accepted',
      expand: {
        applicant: { id: 'u1', collectionId: 'users', collectionName: 'users', username: 'luna' },
        adoption: {
          id: 'a1',
          collectionId: 'adoptions',
          collectionName: 'adoptions',
          pet: 'p1',
          expand: { pet: { id: 'p1', collectionId: 'pets', collectionName: 'pets', name: 'Sol' } },
        },
      },
    });
    expect(mapped).toMatchObject({ adoptionId: 'a1', status: 'accepted', message: 'Hola' });
    expect(mapped.applicant?.username).toBe('luna');
    expect(mapped.adoption?.pet?.name).toBe('Sol');
  });

  it('sends a trimmed message and changes the status', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'r1', status: 'pending' });
    const update = jest.fn().mockResolvedValue({ id: 'r1', status: 'withdrawn' });
    const client = { collection: () => ({ create, update }) } as unknown as PocketBase;
    await actual.sendAdoptionRequest(client, 'u1', 'a1', '  Hola  ');
    expect(create).toHaveBeenCalledWith({ adoption: 'a1', applicant: 'u1', message: 'Hola' });
    expect((await actual.setRequestStatus(client, 'r1', 'withdrawn')).status).toBe('withdrawn');
    expect(update).toHaveBeenCalledWith('r1', { status: 'withdrawn' }, { expand: 'applicant' });
  });
});

describe('on a listing', () => {
  it('sends visitors to sign in, and users to the request form', async () => {
    await renderWith(<RequestSection adoption={LISTING} />, authValue());
    await fireEvent.press(await screen.findByRole('button', { name: 'Quiero adoptar' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/sign-in');

    await renderWith(<RequestSection adoption={LISTING} />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Quiero adoptar' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/adoption/[id]/request',
      params: { id: 'a1' },
    });
  });

  it('shows a pending request and withdraws it', async () => {
    jest.mocked(api.getMyRequest).mockResolvedValue(request('r1', 'pending'));
    jest.mocked(api.setRequestStatus).mockResolvedValue(request('r1', 'withdrawn'));
    await renderWith(<RequestSection adoption={LISTING} />, signedIn());
    expect(await screen.findByText('Tu solicitud: Pendiente')).toBeOnTheScreen();
    expect(screen.getByText('@sol la revisará y te avisará.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Quiero adoptar' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Retirar solicitud' }));
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: '¿Retirar tu solicitud?', destructive: true }),
    );
    await waitFor(() =>
      expect(api.setRequestStatus).toHaveBeenCalledWith(expect.anything(), 'r1', 'withdrawn'),
    );
  });

  it('after an accepted request, offers to write to the publisher', async () => {
    jest.mocked(api.getMyRequest).mockResolvedValue(request('r1', 'accepted'));
    jest.mocked(messagesApi.openConversation).mockResolvedValue('c1');
    await renderWith(<RequestSection adoption={LISTING} />, signedIn());
    expect(
      await screen.findByText('@sol aceptó tu solicitud. Escríbele para conocer a Firulais.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Mensaje' }));
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/messages/[id]',
        params: { id: 'c1' },
      }),
    );
  });

  it('lets nobody ask for a pet that was adopted', async () => {
    await renderWith(<RequestSection adoption={{ ...LISTING, status: 'adopted' }} />, signedIn());
    await waitFor(() => expect(api.getMyRequest).toHaveBeenCalled());
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('takes the publisher to the requests, with the pending count', async () => {
    jest.mocked(api.countPendingRequests).mockResolvedValue(2);
    await renderWith(
      <RequestSection adoption={LISTING} />,
      signedIn({ user: { ...TEST_USER, id: 'u2' } }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Ver solicitudes (2 pendientes)' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/adoption/[id]/requests',
      params: { id: 'a1' },
    });
    expect(api.getMyRequest).not.toHaveBeenCalled();
  });
});

describe('request form', () => {
  it('needs a message, sends it and goes back', async () => {
    jest.mocked(api.sendAdoptionRequest).mockResolvedValue(request('r1', 'pending'));
    const onSent = jest.fn();
    await renderWith(<RequestForm adoption={LISTING} onSent={onSent} />, signedIn());
    expect(await screen.findByText('Quiero adoptar a Firulais')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(screen.getByText('Este campo es obligatorio.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Preséntate'), 'Tengo patio.');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(api.sendAdoptionRequest).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      'a1',
      'Tengo patio.',
    );
    expect(onSent).toHaveBeenCalled();
  });

  it('explains why the server said no', async () => {
    jest
      .mocked(api.sendAdoptionRequest)
      .mockRejectedValue(serverError(400, { adoption: { code: 'already_requested' } }));
    await renderWith(<RequestForm adoption={LISTING} onSent={jest.fn()} />, signedIn());
    await fireEvent.changeText(await screen.findByLabelText('Preséntate'), 'Hola');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(await screen.findByText('Ya pediste adoptar a esta mascota.')).toBeOnTheScreen();
  });
});

describe("publisher's requests", () => {
  const publisher = () => signedIn({ user: { ...TEST_USER, id: 'u2', username: 'sol' } });

  it('shows each applicant with their message, and accepts or rejects', async () => {
    jest.mocked(api.listAdoptionRequests).mockResolvedValue([
      request('r1', 'pending', { applicantId: 'u1', applicant: TEST_USER }),
      request('r2', 'accepted', {
        applicantId: 'u3',
        applicant: ROCCO,
        message: 'Vivo cerca.',
      }),
      request('r3', 'withdrawn', {
        applicantId: 'u4',
        applicant: { ...ROCCO, id: 'u4', username: 'kiwi' },
      }),
    ]);
    jest.mocked(api.setRequestStatus).mockResolvedValue(request('r1', 'accepted'));
    await renderWith(<RequestList adoption={LISTING} />, publisher());
    expect(await screen.findByText('@luna')).toBeOnTheScreen();
    expect(screen.getByText('Vivo cerca.')).toBeOnTheScreen();
    expect(screen.getByText('Pendiente')).toBeOnTheScreen();
    expect(screen.getByText('Aceptada')).toBeOnTheScreen();
    expect(screen.getByText('Retirada')).toBeOnTheScreen();
    // Pending: accept or reject. Accepted: reject. Withdrawn: only a message.
    expect(screen.getAllByRole('button', { name: 'Aceptar' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Rechazar' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Mensaje' })).toHaveLength(3);

    await fireEvent.press(screen.getByRole('button', { name: 'Aceptar' }));
    await waitFor(() =>
      expect(api.setRequestStatus).toHaveBeenCalledWith(expect.anything(), 'r1', 'accepted'),
    );
    await fireEvent.press(screen.getAllByRole('button', { name: 'Rechazar' })[1]!);
    await waitFor(() =>
      expect(api.setRequestStatus).toHaveBeenCalledWith(expect.anything(), 'r2', 'rejected'),
    );

    await fireEvent.press(screen.getByRole('link', { name: '@rocco' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/user/[id]',
      params: { id: 'u3' },
    });
  });

  it('hides blocked applicants and says when there are none', async () => {
    jest
      .mocked(api.listAdoptionRequests)
      .mockResolvedValue([request('r1', 'pending', { applicantId: 'u3', applicant: ROCCO })]);
    jest.mocked(moderationApi.listBlocks).mockResolvedValue([{ id: 'b1', blockedId: 'u3' }]);
    await renderWith(<RequestList adoption={LISTING} />, publisher());
    expect(
      await screen.findByText('Nadie ha pedido adoptar a Firulais todavía.'),
    ).toBeOnTheScreen();
  });
});

describe('my requests', () => {
  it('lists the pets I asked for, with their status, and opens them', async () => {
    jest
      .mocked(api.listSentRequests)
      .mockResolvedValue([request('r1', 'rejected', { adoption: LISTING })]);
    await renderWith(<SentRequests />, signedIn());
    expect(await screen.findByText('Firulais')).toBeOnTheScreen();
    expect(screen.getByText('Publicada por @sol')).toBeOnTheScreen();
    expect(screen.getByText('No aceptada')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: /^Firulais, No aceptada/ }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/adoption/[id]',
      params: { id: 'a1' },
    });
  });

  it('says when there are none', async () => {
    jest.mocked(api.listSentRequests).mockResolvedValue([]);
    await renderWith(<SentRequests />, signedIn());
    expect(await screen.findByText('Aún no has pedido adoptar ninguna mascota.')).toBeOnTheScreen();
  });
});

describe('adoption notifications', () => {
  function notification(
    id: string,
    type: notificationsApi.NotificationType,
  ): notificationsApi.AppNotification {
    return {
      id,
      type,
      actorId: 'u2',
      actor: SOL,
      postId: '',
      commentText: '',
      adoptionId: 'a1',
      adoption: LISTING,
      followupMilestone: '',
      rescueId: '',
      distanceKm: 0,
      read: true,
      created: new Date().toISOString(),
    };
  }

  it('describe the request and its answer, and open the listing or its requests', async () => {
    jest.mocked(notificationsApi.listNotifications).mockResolvedValue({
      items: [
        notification('n1', 'adoption_request'),
        notification('n2', 'request_accepted'),
        notification('n3', 'request_rejected'),
      ],
      page: 1,
      hasMore: false,
    });
    await renderWith(<NotificationList />, signedIn());
    await fireEvent.press(await screen.findByText('@sol quiere adoptar a Firulais.'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/adoption/[id]/requests',
      params: { id: 'a1' },
    });
    await fireEvent.press(screen.getByText('@sol aceptó tu solicitud para adoptar a Firulais.'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/adoption/[id]',
      params: { id: 'a1' },
    });
    expect(
      screen.getByText('@sol no aceptó tu solicitud para adoptar a Firulais.'),
    ).toBeOnTheScreen();
  });

  function Taps() {
    usePushTaps();
    return null;
  }

  it('open from a push too', async () => {
    let tap: ((response: unknown) => void) | undefined;
    jest
      .mocked(Notifications.addNotificationResponseReceivedListener)
      .mockImplementation((listener) => {
        tap = listener as (response: unknown) => void;
        return { remove: jest.fn() };
      });
    await render(<Taps />);
    const open = (data: Record<string, string>) =>
      act(async () => tap?.({ notification: { request: { content: { data } } } }));
    await open({ type: 'adoption_request', adoptionId: 'a1', actorId: 'u1' });
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/adoption/[id]/requests',
      params: { id: 'a1' },
    });
    await open({ type: 'request_accepted', adoptionId: 'a1', actorId: 'u2' });
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/adoption/[id]',
      params: { id: 'a1' },
    });
  });
});
