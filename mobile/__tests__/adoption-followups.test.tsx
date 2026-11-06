import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import type { Adoption } from '@/features/adoption/api';
import { FollowupSection } from '@/features/adoption/FollowupSection';
import * as followupsApi from '@/features/adoption/followups';
import * as moderationApi from '@/features/moderation/api';
import { ReportForm } from '@/features/moderation/ReportForm';
import * as notificationsApi from '@/features/notifications/api';
import { NotificationList } from '@/features/notifications/NotificationList';
import type { Pet } from '@/features/pets/api';
import * as petsApi from '@/features/pets/api';
import { PostComposer } from '@/features/posts/PostComposer';
import { usePushTaps } from '@/features/push/hooks';
import { PREFERENCES_KEY } from '@/preferences/storage';

import { authValue, renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/features/adoption/followups', () => ({
  ...jest.requireActual('@/features/adoption/followups'),
  listFollowups: jest.fn(),
}));
jest.mock('@/features/moderation/api', () => ({
  ...jest.requireActual('@/features/moderation/api'),
  listBlocks: jest.fn(),
  sendReport: jest.fn(),
}));
jest.mock('@/features/notifications/api', () => ({
  ...jest.requireActual('@/features/notifications/api'),
  listNotifications: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));
jest.mock('@/features/pets/api', () => ({
  ...jest.requireActual('@/features/pets/api'),
  listPets: jest.fn(),
}));

const mockRouter = { push: jest.fn() };
const DAY = 24 * 60 * 60 * 1000;
const serverDate = (date: Date) => date.toISOString().replace('T', ' ');
const daysFromNow = (days: number) => serverDate(new Date(Date.now() + days * DAY));

const SOL = { ...TEST_USER, id: 'u2', username: 'sol', bio: '' };

const MICHI: Pet = {
  id: 'p1',
  collectionId: 'pets',
  ownerId: 'u1',
  name: 'Michi',
  species: 'cat',
  breed: '',
  birthDate: '',
  photo: '',
  previousOwnerId: 'u2',
  adoptedAt: daysFromNow(-40),
};

/** Sol gave Michi up for adoption and Luna (TEST_USER, u1) adopted her. */
const ADOPTED: Adoption = {
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
  status: 'adopted',
  adopterId: 'u1',
  adopter: TEST_USER,
  adoptedAt: daysFromNow(-40),
  created: daysFromNow(-60),
};

function followup(
  milestone: followupsApi.Milestone,
  dueInDays: number,
  postId = '',
): followupsApi.Followup {
  return {
    id: `f-${milestone}`,
    adoptionId: 'a1',
    milestone,
    dueAt: daysFromNow(dueInDays),
    postId,
  };
}

/** Week 1 done, month 1 overdue, month 3 due, month 6 upcoming. */
const MIXED = [
  followup('week1', -33, 'post1'),
  followup('month1', -20),
  followup('month3', -2),
  followup('month6', 60),
];

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(moderationApi.listBlocks).mockResolvedValue([]);
  jest.mocked(followupsApi.listFollowups).mockResolvedValue(MIXED);
  jest.mocked(petsApi.listPets).mockResolvedValue([MICHI]);
});

describe('follow-up state', () => {
  const { followupState } = jest.requireActual<typeof followupsApi>(
    '@/features/adoption/followups',
  );
  const now = new Date('2026-11-20T12:00:00Z');
  const at = (dueAt: string, postId = '') =>
    followupState({ id: 'f', adoptionId: 'a1', milestone: 'week1', dueAt, postId }, now);

  it('is upcoming, due for 14 days, then overdue, unless it has a post', () => {
    expect(at('2026-11-25 00:00:00.000Z')).toBe('upcoming');
    expect(at('2026-11-19 00:00:00.000Z')).toBe('due');
    expect(at('2026-11-07 00:00:00.000Z')).toBe('due');
    expect(at('2026-11-06 00:00:00.000Z')).toBe('overdue');
    expect(at('2026-11-06 00:00:00.000Z', 'post1')).toBe('done');
  });
});

describe('on the adopted listing', () => {
  it('shows the adopter each follow-up and lets them share the pending one', async () => {
    await renderWith(<FollowupSection adoption={ADOPTED} />, signedIn());
    expect(await screen.findByText('Seguimiento')).toBeOnTheScreen();
    for (const label of ['1 semana', '1 mes', '3 meses', '6 meses']) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(screen.getByText('Cumplido')).toBeOnTheScreen();
    expect(screen.getByText(/^Vencido · Venció el /)).toBeOnTheScreen();
    expect(screen.getByText(/^Pendiente · Hasta el /)).toBeOnTheScreen();
    expect(screen.getByText(/^Próximo · El /)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reportar seguimiento no cumplido' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Compartir actualización' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/post',
      params: { petId: 'p1' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Ver la publicación' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/post/[id]',
      params: { id: 'post1' },
    });
  });

  it('lets the previous owner report a missed follow-up', async () => {
    await renderWith(
      <FollowupSection adoption={ADOPTED} />,
      signedIn({ user: { ...TEST_USER, id: 'u2', username: 'sol' } }),
    );
    expect(
      await screen.findByText('Aquí verás las actualizaciones de @luna sobre Michi.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Compartir actualización' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Reportar seguimiento no cumplido' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/report',
      params: { kind: 'user', id: 'u1', reason: 'adoption_followup' },
    });
  });

  it('offers no report while nothing is overdue', async () => {
    jest
      .mocked(followupsApi.listFollowups)
      .mockResolvedValue([followup('week1', -3), followup('month1', 20)]);
    await renderWith(
      <FollowupSection adoption={ADOPTED} />,
      signedIn({ user: { ...TEST_USER, id: 'u2', username: 'sol' } }),
    );
    await screen.findByText('Seguimiento');
    expect(screen.queryByRole('button', { name: 'Reportar seguimiento no cumplido' })).toBeNull();
  });

  it('is hidden from everyone else and before the adoption', async () => {
    await renderWith(<FollowupSection adoption={ADOPTED} />, authValue());
    await renderWith(
      <FollowupSection adoption={ADOPTED} />,
      signedIn({ user: { ...TEST_USER, id: 'u3' } }),
    );
    await renderWith(
      <FollowupSection adoption={{ ...ADOPTED, status: 'available', adopterId: '' }} />,
      signedIn({ user: { ...TEST_USER, id: 'u2' } }),
    );
    expect(screen.queryByText('Seguimiento')).toBeNull();
    expect(followupsApi.listFollowups).not.toHaveBeenCalled();
  });
});

describe('reporting a missed follow-up', () => {
  it('only offers that reason and explains when it is not possible', async () => {
    jest
      .mocked(moderationApi.sendReport)
      .mockRejectedValueOnce(serverError(400, { reason: { code: 'followup_not_overdue' } }))
      .mockResolvedValueOnce(undefined);
    const onSent = jest.fn();
    await renderWith(
      <ReportForm target={{ kind: 'user', id: 'u1' }} reason="adoption_followup" onSent={onSent} />,
      signedIn({ user: { ...TEST_USER, id: 'u2' } }),
    );
    const reasons = await screen.findAllByRole('radio');
    expect(reasons).toHaveLength(1);
    expect(
      screen.getByRole('radio', { name: 'Seguimiento de adopción no cumplido', checked: true }),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(
      await screen.findByText(
        'Solo puedes reportar un seguimiento vencido de una mascota que diste en adopción.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    expect(moderationApi.sendReport).toHaveBeenLastCalledWith(
      expect.anything(),
      'u2',
      { kind: 'user', id: 'u1' },
      'adoption_followup',
      '',
    );
  });
});

describe('sharing an update', () => {
  it('opens the composer with the pet already tagged', async () => {
    await renderWith(<PostComposer petId="p1" onPublished={jest.fn()} />, signedIn());
    expect(await screen.findByRole('checkbox', { name: 'Michi', checked: true })).toBeOnTheScreen();
  });
});

describe('follow-up notifications', () => {
  function notification(
    id: string,
    type: notificationsApi.NotificationType,
    overrides: Partial<notificationsApi.AppNotification> = {},
  ): notificationsApi.AppNotification {
    return {
      id,
      type,
      actorId: 'u2',
      actor: SOL,
      postId: '',
      commentText: '',
      adoptionId: 'a1',
      adoption: ADOPTED,
      followupMilestone: 'month1',
      rescueId: '',
      distanceKm: 0,
      contentKind: '',
      reportReason: '',
      read: true,
      created: new Date().toISOString(),
      ...overrides,
    };
  }

  it('remind the adopter and tell the previous owner, opening the composer or the post', async () => {
    jest.mocked(notificationsApi.listNotifications).mockResolvedValue({
      items: [
        notification('n1', 'followup_due'),
        notification('n2', 'followup_posted', {
          actorId: 'u1',
          actor: TEST_USER,
          postId: 'post9',
        }),
      ],
      page: 1,
      hasMore: false,
    });
    await renderWith(<NotificationList />, signedIn());
    await fireEvent.press(
      await screen.findByText(
        'Ya pasó 1 mes desde que adoptaste a Michi. Comparte una foto o video para @sol.',
      ),
    );
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/post',
      params: { petId: 'p1' },
    });
    await fireEvent.press(screen.getByText('@luna compartió cómo está Michi.'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/post/[id]',
      params: { id: 'post9' },
    });
  });

  function Taps() {
    usePushTaps();
    return null;
  }

  it('open the composer from a reminder push', async () => {
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
          request: { content: { data: { type: 'followup_due', petId: 'p1', actorId: 'u2' } } },
        },
      }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/post', params: { petId: 'p1' } });
  });
});
