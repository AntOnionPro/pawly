import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import type PocketBase from 'pocketbase';

import { AdoptionDetail } from '@/features/adoption/AdoptionDetail';
import * as api from '@/features/adoption/api';
import { CompleteAdoption } from '@/features/adoption/CompleteAdoption';
import { PetAdoptionHistory } from '@/features/adoption/PetAdoptionHistory';
import * as requestsApi from '@/features/adoption/requests';
import { RequestSection } from '@/features/adoption/RequestSection';
import * as moderationApi from '@/features/moderation/api';
import * as notificationsApi from '@/features/notifications/api';
import { NotificationList } from '@/features/notifications/NotificationList';
import { toPet, type Pet } from '@/features/pets/api';
import { usePushTaps } from '@/features/push/hooks';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { confirm } from '@/utils/confirm';

import { authValue, renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
jest.mock('@/features/adoption/api', () => ({
  ...jest.requireActual('@/features/adoption/api'),
  completeAdoption: jest.fn(),
  getAdoptedListing: jest.fn(),
}));
jest.mock('@/features/adoption/requests', () => ({
  ...jest.requireActual('@/features/adoption/requests'),
  getMyRequest: jest.fn(),
  listAdoptionRequests: jest.fn(),
  countPendingRequests: jest.fn(),
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

const mockRouter = { push: jest.fn(), replace: jest.fn() };

const SOL = { ...TEST_USER, id: 'u2', username: 'sol', bio: '' };
const ROCCO = { ...TEST_USER, id: 'u3', username: 'rocco', bio: '' };

const MICHI: Pet = {
  id: 'p1',
  collectionId: 'pets',
  ownerId: 'u2',
  name: 'Michi',
  species: 'cat',
  breed: '',
  birthDate: '',
  photo: '',
  previousOwnerId: '',
  adoptedAt: '',
};

const LISTING: api.Adoption = {
  id: 'a1',
  collectionId: 'adoptions',
  publisherId: 'u2',
  publisher: SOL,
  petId: 'p1',
  pet: MICHI,
  sex: 'female',
  size: 'small',
  vaccines: 'complete',
  sterilized: true,
  health: '',
  zone: 'Tlalpan, CDMX',
  requirements: '',
  description: '',
  media: [],
  status: 'available',
  adopterId: '',
  adoptedAt: '',
  created: new Date().toISOString(),
};

const ADOPTED: api.Adoption = {
  ...LISTING,
  status: 'adopted',
  adopterId: 'u1',
  adopter: TEST_USER,
  adoptedAt: '2026-11-05 18:00:00.000Z',
};

function request(
  id: string,
  status: requestsApi.RequestStatus,
  applicant = TEST_USER,
): requestsApi.AdoptionRequest {
  return {
    id,
    adoptionId: 'a1',
    applicantId: applicant.id,
    applicant,
    message: 'Hola',
    status,
    created: new Date().toISOString(),
  };
}

const asPublisher = () => signedIn({ user: { ...TEST_USER, id: 'u2', username: 'sol' } });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(moderationApi.listBlocks).mockResolvedValue([]);
  jest.mocked(requestsApi.countPendingRequests).mockResolvedValue(0);
  jest.mocked(requestsApi.getMyRequest).mockResolvedValue(null);
  jest.mocked(confirm).mockResolvedValue(true);
});

describe('API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/adoption/api');

  it('asks the server to complete the adoption with the chosen request', async () => {
    const send = jest.fn().mockResolvedValue({
      id: 'a1',
      collectionId: 'adoptions',
      status: 'adopted',
      adopter: 'u1',
      adoptedAt: '2026-11-05 18:00:00.000Z',
    });
    const client = { send } as unknown as PocketBase;
    const adoption = await actual.completeAdoption(client, 'a1', 'r1');
    expect(send).toHaveBeenCalledWith('/api/pawly/adoptions/a1/adopt', {
      method: 'POST',
      body: { request: 'r1' },
    });
    expect(adoption).toMatchObject({ status: 'adopted', adopterId: 'u1' });
  });

  it('maps where an adopted pet came from', () => {
    const pet = toPet({
      id: 'p1',
      collectionId: 'pets',
      collectionName: 'pets',
      owner: 'u1',
      previousOwner: 'u2',
      adoptedAt: '2026-11-05 18:00:00.000Z',
    });
    expect(pet).toMatchObject({ ownerId: 'u1', previousOwnerId: 'u2' });
    expect(pet.adoptedAt).toBe('2026-11-05 18:00:00.000Z');
  });
});

describe('marking as adopted', () => {
  it('is offered to the publisher while the pet is available', async () => {
    await renderWith(<RequestSection adoption={LISTING} />, asPublisher());
    await fireEvent.press(await screen.findByRole('button', { name: 'Marcar como adoptada' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/adoption/[id]/complete',
      params: { id: 'a1' },
    });

    await renderWith(<RequestSection adoption={ADOPTED} />, asPublisher());
    await screen.findByRole('button', { name: 'Ver solicitudes' });
    expect(screen.queryByRole('button', { name: 'Marcar como adoptada' })).toBeNull();
  });

  it('chooses among the accepted requests and confirms', async () => {
    jest
      .mocked(requestsApi.listAdoptionRequests)
      .mockResolvedValue([request('r1', 'accepted'), request('r2', 'pending', ROCCO)]);
    jest.mocked(api.completeAdoption).mockResolvedValue(ADOPTED);
    const onDone = jest.fn();
    await renderWith(<CompleteAdoption adoption={LISTING} onDone={onDone} />, asPublisher());
    expect(await screen.findByRole('radio', { name: '@luna' })).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: '@rocco' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar adopción' }));
    expect(screen.getByText('Elige a quien adoptó a la mascota.')).toBeOnTheScreen();
    expect(confirm).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('radio', { name: '@luna' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar adopción' }));
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: '¿@luna adoptó a Michi?' }),
    );
    await waitFor(() =>
      expect(api.completeAdoption).toHaveBeenCalledWith(expect.anything(), 'a1', 'r1'),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('does nothing if the publisher changes their mind, and shows server errors', async () => {
    jest.mocked(requestsApi.listAdoptionRequests).mockResolvedValue([request('r1', 'accepted')]);
    jest.mocked(confirm).mockResolvedValueOnce(false);
    jest
      .mocked(api.completeAdoption)
      .mockRejectedValue(serverError(400, { adoption: { code: 'adoption_closed' } }));
    await renderWith(<CompleteAdoption adoption={LISTING} onDone={jest.fn()} />, asPublisher());
    await fireEvent.press(await screen.findByRole('radio', { name: '@luna' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar adopción' }));
    expect(api.completeAdoption).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar adopción' }));
    expect(await screen.findByText('Esta mascota ya no está en adopción.')).toBeOnTheScreen();
  });

  it('asks to accept a request first', async () => {
    jest.mocked(requestsApi.listAdoptionRequests).mockResolvedValue([request('r2', 'pending')]);
    await renderWith(<CompleteAdoption adoption={LISTING} onDone={jest.fn()} />, asPublisher());
    expect(
      await screen.findByText('Primero acepta la solicitud de quien va a adoptar a Michi.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver solicitudes' }));
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/adoption/[id]/requests',
      params: { id: 'a1' },
    });
  });
});

describe('an adopted listing', () => {
  it('says who adopted the pet', async () => {
    const onPressUser = jest.fn();
    await renderWith(
      <AdoptionDetail adoption={ADOPTED} onPressPet={jest.fn()} onPressUser={onPressUser} />,
      authValue(),
    );
    expect(await screen.findByText('Adoptada')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Adoptada por @luna' }));
    expect(onPressUser).toHaveBeenCalledWith('u1');
  });

  it('congratulates the adopter, and nobody can ask for it anymore', async () => {
    jest.mocked(requestsApi.getMyRequest).mockResolvedValue(request('r1', 'accepted'));
    await renderWith(<RequestSection adoption={ADOPTED} />, signedIn());
    expect(
      await screen.findByText('¡Felicidades! Ahora Michi es parte de tu familia.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();

    jest.mocked(requestsApi.getMyRequest).mockResolvedValue(null);
    await renderWith(
      <RequestSection adoption={ADOPTED} />,
      signedIn({ user: { ...TEST_USER, id: 'u3' } }),
    );
    await waitFor(() => expect(requestsApi.getMyRequest).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Quiero adoptar' })).toBeNull();
  });
});

describe("the pet's profile", () => {
  it('shows when it was adopted, with a link to its listing', async () => {
    jest.mocked(api.getAdoptedListing).mockResolvedValue(ADOPTED);
    await renderWith(
      <PetAdoptionHistory
        pet={{ ...MICHI, ownerId: 'u1', previousOwnerId: 'u2', adoptedAt: ADOPTED.adoptedAt }}
      />,
      authValue(),
    );
    expect(await screen.findByText('Adopción')).toBeOnTheScreen();
    expect(screen.getByText(/^Adoptada el 5 de noviembre de 2026/)).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver ficha de adopción' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/adoption/[id]',
      params: { id: 'a1' },
    });
  });

  it('shows nothing for a pet that was not adopted in Pawly', async () => {
    await renderWith(<PetAdoptionHistory pet={MICHI} />, authValue());
    expect(screen.queryByText('Adopción')).toBeNull();
    expect(api.getAdoptedListing).not.toHaveBeenCalled();
  });
});

describe('the congratulations', () => {
  it('appear in the notifications and open the pet', async () => {
    jest.mocked(notificationsApi.listNotifications).mockResolvedValue({
      items: [
        {
          id: 'n1',
          type: 'adopted',
          actorId: 'u2',
          actor: SOL,
          postId: '',
          commentText: '',
          adoptionId: 'a1',
          adoption: ADOPTED,
          followupMilestone: '',
          rescueId: '',
          read: true,
          created: new Date().toISOString(),
        },
      ],
      page: 1,
      hasMore: false,
    });
    await renderWith(<NotificationList />, signedIn());
    await fireEvent.press(
      await screen.findByText('¡Felicidades! Ahora Michi es parte de tu familia.'),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pet/[id]', params: { id: 'p1' } });
  });

  function Taps() {
    usePushTaps();
    return null;
  }

  it('open the pet from a push', async () => {
    let tap: ((response: unknown) => void) | undefined;
    jest
      .mocked(Notifications.addNotificationResponseReceivedListener)
      .mockImplementation((listener) => {
        tap = listener as (response: unknown) => void;
        return { remove: jest.fn() };
      });
    await render(<Taps />);
    await act(async () =>
      tap?.({
        notification: {
          request: { content: { data: { type: 'adopted', petId: 'p1', actorId: 'u2' } } },
        },
      }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pet/[id]', params: { id: 'p1' } });
  });
});
