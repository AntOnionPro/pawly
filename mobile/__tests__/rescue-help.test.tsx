import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import type PocketBase from 'pocketbase';

import * as moderationApi from '@/features/moderation/api';
import * as notificationsApi from '@/features/notifications/api';
import { NotificationList } from '@/features/notifications/NotificationList';
import { usePushTaps } from '@/features/push/hooks';
import type { RescueReport } from '@/features/rescue/api';
import * as api from '@/features/rescue/helpers';
import { HelpSection } from '@/features/rescue/HelpSection';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { confirm } from '@/utils/confirm';

import { authValue, renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
jest.mock('@/features/rescue/helpers', () => ({
  ...jest.requireActual('@/features/rescue/helpers'),
  getMyOffer: jest.fn(),
  listHelpOffers: jest.fn(),
  offerHelp: jest.fn(),
  withdrawHelp: jest.fn(),
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

const REPORT: RescueReport = {
  id: 'r1',
  collectionId: 'rescue_reports',
  reporterId: 'u2',
  reporter: SOL,
  kind: 'help',
  description: 'Perrito atrapado',
  media: [],
  latitude: 19.35,
  longitude: -99.16,
  place: '',
  urgency: 'high',
  petId: '',
  lastSeenAt: '',
  status: 'open',
  helperCount: 0,
  created: new Date().toISOString(),
};

function offer(id: string, helper = TEST_USER, message = ''): api.HelpOffer {
  return {
    id,
    reportId: 'r1',
    helperId: helper.id,
    helper,
    message,
    created: new Date().toISOString(),
  };
}

const asReporter = () => signedIn({ user: { ...TEST_USER, id: 'u2', username: 'sol' } });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(moderationApi.listBlocks).mockResolvedValue([]);
  jest.mocked(api.getMyOffer).mockResolvedValue(null);
  jest.mocked(api.listHelpOffers).mockResolvedValue([]);
  jest.mocked(confirm).mockResolvedValue(true);
});

describe('help API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/rescue/helpers');

  it('maps an offer and sends it with a trimmed message', async () => {
    expect(
      actual.toHelpOffer({
        id: 'h1',
        collectionId: 'rescue_helpers',
        collectionName: 'rescue_helpers',
        report: 'r1',
        helper: 'u1',
        message: 'Voy',
        expand: {
          helper: { id: 'u1', collectionId: 'u', collectionName: 'users', username: 'luna' },
        },
      }),
    ).toMatchObject({ reportId: 'r1', helperId: 'u1', message: 'Voy' });

    const create = jest.fn().mockResolvedValue({ id: 'h1' });
    const remove = jest.fn().mockResolvedValue(true);
    const client = { collection: () => ({ create, delete: remove }) } as unknown as PocketBase;
    await actual.offerHelp(client, 'u1', 'r1', '  Voy en 10 min  ');
    expect(create).toHaveBeenCalledWith({ report: 'r1', helper: 'u1', message: 'Voy en 10 min' });
    await actual.withdrawHelp(client, 'h1');
    expect(remove).toHaveBeenCalledWith('h1');
  });
});

describe('I can help', () => {
  it('is only on reports of animals that need help', async () => {
    await renderWith(<HelpSection report={{ ...REPORT, kind: 'lost' }} />, signedIn());
    expect(screen.queryByRole('button', { name: 'Puedo ayudar' })).toBeNull();
  });

  it('sends visitors to sign in', async () => {
    await renderWith(<HelpSection report={REPORT} />, authValue());
    await fireEvent.press(await screen.findByRole('button', { name: 'Puedo ayudar' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
  });

  it('offers help with a message, then lets you withdraw it', async () => {
    jest.mocked(api.offerHelp).mockResolvedValue(offer('h1'));
    await renderWith(<HelpSection report={REPORT} />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Puedo ayudar' }));
    await fireEvent.changeText(
      screen.getByLabelText('Mensaje para @sol (opcional)'),
      'Llego en 10 minutos',
    );
    jest.mocked(api.getMyOffer).mockResolvedValue(offer('h1', TEST_USER, 'Llego en 10 minutos'));
    await fireEvent.press(screen.getByRole('button', { name: 'Ofrecer ayuda' }));
    expect(api.offerHelp).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      'r1',
      'Llego en 10 minutos',
    );
    expect(
      await screen.findByText('Te ofreciste a ayudar. Escríbele a @sol para coordinarse.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mensaje' })).toBeOnTheScreen();

    jest.mocked(api.getMyOffer).mockResolvedValue(null);
    await fireEvent.press(screen.getByRole('button', { name: 'Ya no puedo ayudar' }));
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: '¿Ya no puedes ayudar?', destructive: true }),
    );
    await waitFor(() => expect(api.withdrawHelp).toHaveBeenCalledWith(expect.anything(), 'h1'));
  });

  it('explains why an offer was not saved', async () => {
    jest
      .mocked(api.offerHelp)
      .mockRejectedValue(serverError(400, { report: { code: 'report_closed' } }));
    await renderWith(<HelpSection report={REPORT} />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Puedo ayudar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Ofrecer ayuda' }));
    expect(
      await screen.findByText('No se pudo guardar. Este caso ya está cerrado.'),
    ).toBeOnTheScreen();
  });

  it('shows how many offered, and no button once the case is closed', async () => {
    await renderWith(
      <HelpSection report={{ ...REPORT, status: 'closed', helperCount: 2 }} />,
      signedIn(),
    );
    expect(await screen.findByText('2 personas se ofrecieron a ayudar')).toBeOnTheScreen();
    await waitFor(() => expect(api.getMyOffer).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Puedo ayudar' })).toBeNull();
  });
});

describe("the reporter's list", () => {
  it('shows who can help, with their message and a way to write', async () => {
    jest
      .mocked(api.listHelpOffers)
      .mockResolvedValue([offer('h1', TEST_USER, 'Tengo transportadora'), offer('h2', ROCCO)]);
    await renderWith(<HelpSection report={{ ...REPORT, helperCount: 2 }} />, asReporter());
    expect(await screen.findByText('Tengo transportadora')).toBeOnTheScreen();
    expect(screen.getByText('Quienes pueden ayudar')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Mensaje' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Puedo ayudar' })).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: '@rocco' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'u3' } });
  });

  it('says when nobody offered yet, and hides blocked people', async () => {
    jest.mocked(api.listHelpOffers).mockResolvedValue([offer('h2', ROCCO)]);
    jest.mocked(moderationApi.listBlocks).mockResolvedValue([{ id: 'b1', blockedId: 'u3' }]);
    await renderWith(<HelpSection report={REPORT} />, asReporter());
    expect(
      await screen.findByText(
        'Nadie se ha ofrecido todavía. Te avisaremos cuando alguien pueda ayudar.',
      ),
    ).toBeOnTheScreen();
  });
});

describe('help notifications', () => {
  it('tell the reporter and open the case', async () => {
    jest.mocked(notificationsApi.listNotifications).mockResolvedValue({
      items: [
        {
          id: 'n1',
          type: 'rescue_help',
          actorId: 'u1',
          actor: TEST_USER,
          postId: '',
          commentText: '',
          adoptionId: '',
          followupMilestone: '',
          rescueId: 'r1',
          distanceKm: 0,
          rescue: REPORT,
          read: true,
          created: new Date().toISOString(),
        },
      ],
      page: 1,
      hasMore: false,
    });
    await renderWith(<NotificationList />, asReporter());
    await fireEvent.press(await screen.findByText('@luna puede ayudar con tu caso de rescate.'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/rescue/[id]',
      params: { id: 'r1' },
    });
  });

  function Taps() {
    usePushTaps();
    return null;
  }

  it('open the case from a push', async () => {
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
          request: { content: { data: { type: 'rescue_help', rescueId: 'r1', actorId: 'u1' } } },
        },
      }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/rescue/[id]',
      params: { id: 'r1' },
    });
  });
});
