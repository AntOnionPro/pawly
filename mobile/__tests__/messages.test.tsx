import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type PocketBase from 'pocketbase';
import type { RecordSubscription } from 'pocketbase';

import { installEventSource } from '@/api/eventSource';
import * as followsApi from '@/features/follows/api';
import { ChatView } from '@/features/messages/ChatView';
import { ConversationList } from '@/features/messages/ConversationList';
import * as api from '@/features/messages/api';
import { MessagesButton } from '@/features/messages/MessagesButton';
import * as moderationApi from '@/features/moderation/api';
import * as petsApi from '@/features/pets/api';
import * as postsApi from '@/features/posts/api';
import { FeedList } from '@/features/posts/FeedList';
import * as usersApi from '@/features/users/api';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { confirm } from '@/utils/confirm';
import ReportScreen from '@/app/report';
import UserScreen from '@/app/user/[id]';

import { authValue, renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  Redirect: () => null,
}));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
jest.mock('@/utils/notify', () => ({ notify: jest.fn() }));
jest.mock('@/features/messages/api', () => ({
  ...jest.requireActual('@/features/messages/api'),
  listConversations: jest.fn(),
  countUnread: jest.fn(),
  getConversation: jest.fn(),
  openConversation: jest.fn(),
  listMessages: jest.fn(),
  sendMessage: jest.fn(),
  markRead: jest.fn(),
}));
jest.mock('@/features/moderation/api', () => ({
  ...jest.requireActual('@/features/moderation/api'),
  listBlocks: jest.fn(),
}));
jest.mock('@/features/users/api', () => ({
  ...jest.requireActual('@/features/users/api'),
  getUser: jest.fn(),
}));
jest.mock('@/features/follows/api', () => ({
  ...jest.requireActual('@/features/follows/api'),
  findFollow: jest.fn(),
}));
jest.mock('@/features/pets/api', () => ({
  ...jest.requireActual('@/features/pets/api'),
  listPets: jest.fn(),
}));
jest.mock('@/features/posts/api', () => ({
  ...jest.requireActual('@/features/posts/api'),
  listPosts: jest.fn(),
}));

const mockRouter = { push: jest.fn(), back: jest.fn(), canGoBack: () => true };
let mockParams: Record<string, string> = {};

const SOL = { ...TEST_USER, id: 'u2', username: 'sol', bio: '' };

const CONVERSATION: api.Conversation = {
  id: 'c1',
  otherId: 'u2',
  other: SOL,
  lastMessageText: '¿Sigue en adopción?',
  lastMessageAt: new Date().toISOString(),
  lastSenderId: 'u2',
  unread: true,
};

function message(id: string, senderId: string, text: string): api.Message {
  return {
    id,
    conversationId: 'c1',
    senderId,
    text,
    created: '2026-11-05 15:30:00.000Z',
    hasPost: false,
  };
}

/** Fake client whose realtime subscriptions can be triggered from the test. */
function realtimeClient() {
  const listeners: Record<string, (event: RecordSubscription) => void> = {};
  const client = {
    files: { getURL: () => '' },
    filter: (expression: string, params: Record<string, string>) =>
      Object.entries(params).reduce(
        (text, [key, value]) => text.replaceAll(`{:${key}}`, `"${value}"`),
        expression,
      ),
    collection: (name: string) => ({
      subscribe: jest.fn(async (_topic: string, listener: (event: RecordSubscription) => void) => {
        listeners[name] = listener;
        return async () => undefined;
      }),
    }),
  } as unknown as PocketBase;
  return { client, emit: (name: string, event: RecordSubscription) => listeners[name]?.(event) };
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(confirm).mockResolvedValue(true);
  jest.mocked(moderationApi.listBlocks).mockResolvedValue([]);
  jest.mocked(api.countUnread).mockResolvedValue(0);
  jest.mocked(api.markRead).mockResolvedValue(undefined);
  jest.mocked(api.getConversation).mockResolvedValue(CONVERSATION);
  jest.mocked(api.listMessages).mockResolvedValue({
    items: [message('m2', 'u1', 'Sí, sigue'), message('m1', 'u2', '¿Sigue en adopción?')],
    next: null,
  });
  jest.mocked(postsApi.listPosts).mockResolvedValue({ items: [], page: 1, hasMore: false });
});

describe('messages API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/messages/api');

  function fakeClient(getList: jest.Mock, extra: Record<string, jest.Mock> = {}) {
    return {
      collection: () => ({ getList, ...extra }),
      filter: (expression: string, params: Record<string, string>) =>
        Object.entries(params).reduce(
          (text, [key, value]) => text.replaceAll(`{:${key}}`, `"${value}"`),
          expression,
        ),
    } as unknown as PocketBase;
  }

  it('maps a conversation from either side and knows when it is unread', () => {
    const record = {
      id: 'c1',
      collectionId: 'conversations',
      collectionName: 'conversations',
      userA: 'u1',
      userB: 'u2',
      lastMessageText: 'Hola',
      lastMessageAt: '2026-11-05 15:00:00.000Z',
      lastSender: 'u2',
      readA: '2026-11-05 14:00:00.000Z',
      readB: '2026-11-05 15:00:00.000Z',
      expand: { userB: { id: 'u2', username: 'sol' } },
    };
    const mine = actual.toConversation(record, 'u1');
    expect(mine).toMatchObject({ otherId: 'u2', unread: true });
    expect(mine.other?.username).toBe('sol');
    expect(actual.toConversation(record, 'u2').unread).toBe(false);
    expect(
      actual.toConversation({ ...record, readA: '2026-11-05 15:10:00.000Z' }, 'u1').unread,
    ).toBe(false);
  });

  it('lists conversations with messages, the most recent first', async () => {
    const getList = jest.fn().mockResolvedValue({ items: [] });
    await actual.listConversations(fakeClient(getList), 'u1', 1, 30);
    expect(getList).toHaveBeenCalledWith(1, 30, {
      filter: `(userA = "u1" || userB = "u1") && lastMessageAt != ''`,
      sort: '-lastMessageAt,-id',
      expand: 'userA,userB',
      skipTotal: true,
    });
  });

  it('counts unread conversations', async () => {
    const getList = jest.fn().mockResolvedValue({ items: [], totalItems: 3 });
    expect(await actual.countUnread(fakeClient(getList), 'u1')).toBe(3);
    expect(getList.mock.calls[0]?.[2].filter).toContain('lastSender != "u1"');
  });

  it('opens the existing conversation, or creates it', async () => {
    const getList = jest.fn().mockResolvedValueOnce({ items: [{ id: 'c1' }] });
    const create = jest.fn();
    const client = fakeClient(getList, { create });
    expect(await actual.openConversation(client, 'u2', 'u1')).toBe('c1');
    expect(getList.mock.calls[0]?.[2].filter).toBe('userA = "u1" && userB = "u2"');
    expect(create).not.toHaveBeenCalled();

    getList.mockResolvedValueOnce({ items: [] });
    create.mockResolvedValueOnce({ id: 'c9' });
    expect(await actual.openConversation(client, 'u1', 'u3')).toBe('c9');
    expect(create).toHaveBeenCalledWith({ userA: 'u1', userB: 'u3' });
  });

  it('uses the conversation someone else created at the same time', async () => {
    const getList = jest
      .fn()
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [{ id: 'c5' }] });
    const create = jest
      .fn()
      .mockRejectedValue(
        serverError(400, { userA: { code: 'validation_not_unique', message: 'x' } }),
      );
    expect(await actual.openConversation(fakeClient(getList, { create }), 'u1', 'u2')).toBe('c5');
  });

  it('pages messages from the newest, continuing before the oldest', async () => {
    const getList = jest.fn().mockResolvedValue({
      items: [
        { id: 'b', conversation: 'c1', created: '2026-11-05 15:00:00.000Z' },
        { id: 'a', conversation: 'c1', created: '2026-11-05 14:00:00.000Z' },
      ],
    });
    const client = fakeClient(getList);
    const first = await actual.listMessages(client, 'c1', null, 2);
    expect(getList.mock.calls[0]?.[2]).toMatchObject({
      filter: 'conversation = "c1"',
      sort: '-created,-id',
    });
    expect(first.next).toEqual({ created: '2026-11-05 14:00:00.000Z', id: 'a' });
    await actual.listMessages(client, 'c1', first.next, 2);
    expect(getList.mock.calls[1]?.[2].filter).toBe(
      'conversation = "c1" && (created < "2026-11-05 14:00:00.000Z" || (created = "2026-11-05 14:00:00.000Z" && id < "a"))',
    );
  });

  it('sends trimmed text and marks as read with an empty update', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'm1', text: 'Hola' });
    const update = jest.fn().mockResolvedValue({});
    const client = fakeClient(jest.fn(), { create, update });
    await actual.sendMessage(client, 'u1', 'c1', '  Hola ');
    expect(create).toHaveBeenCalledWith(
      { conversation: 'c1', sender: 'u1', text: 'Hola', post: '' },
      { expand: 'post,post.author' },
    );
    await actual.markRead(client, 'c1');
    expect(update).toHaveBeenCalledWith('c1', {});
  });

  it('gives iOS and Android an EventSource for realtime', () => {
    const global = globalThis as { EventSource?: unknown };
    const previous = global.EventSource;
    delete global.EventSource;
    installEventSource();
    expect(typeof global.EventSource).toBe('function');
    global.EventSource = previous;
  });
});

describe('messages button', () => {
  it('shows the unread count and opens the conversations', async () => {
    jest.mocked(api.countUnread).mockResolvedValue(2);
    await renderWith(<MessagesButton />, signedIn());
    expect(await screen.findByText('2')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mensajes' }).props.accessibilityHint).toBe(
      '2 conversaciones sin leer',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Mensajes' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/messages');
  });

  it('is on Home only with a session', async () => {
    await renderWith(<FeedList />, authValue());
    await screen.findByRole('button', { name: 'Buscar' });
    expect(screen.queryByRole('button', { name: 'Mensajes' })).toBeNull();
  });
});

describe('conversation list', () => {
  it('shows each conversation with its preview, and opens it', async () => {
    jest.mocked(api.listConversations).mockResolvedValue({
      items: [CONVERSATION, { ...CONVERSATION, id: 'c2', lastSenderId: 'u1', unread: false }],
      page: 1,
      hasMore: false,
    });
    await renderWith(<ConversationList />, signedIn());
    const rows = await screen.findAllByRole('link', { name: /^@sol/ });
    expect(rows[0]?.props.accessibilityLabel).toMatch(/^@sol, sin leer, ¿Sigue en adopción\?/);
    expect(screen.getByText('Tú: ¿Sigue en adopción?')).toBeOnTheScreen();
    await fireEvent.press(rows[0]!);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/messages/[id]',
      params: { id: 'c1' },
    });
  });

  it('says when there are none, and hides blocked users', async () => {
    jest.mocked(moderationApi.listBlocks).mockResolvedValue([{ id: 'b1', blockedId: 'u2' }]);
    jest
      .mocked(api.listConversations)
      .mockResolvedValue({ items: [CONVERSATION], page: 1, hasMore: false });
    await renderWith(<ConversationList />, signedIn());
    expect(
      await screen.findByText('Todavía no tienes mensajes. Escríbele a alguien desde su perfil.'),
    ).toBeOnTheScreen();
  });
});

describe('chat', () => {
  it('shows the messages, marks them as read and sends new ones', async () => {
    jest.mocked(api.sendMessage).mockResolvedValue(message('m3', 'u1', '¡Genial!'));
    await renderWith(<ChatView conversationId="c1" />, signedIn());
    expect(await screen.findByText('¿Sigue en adopción?')).toBeOnTheScreen();
    expect(screen.getByText('Sí, sigue')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: '@sol' })).toBeOnTheScreen();
    await waitFor(() => expect(api.markRead).toHaveBeenCalledWith(expect.anything(), 'c1'));

    await fireEvent.changeText(screen.getByLabelText('Mensaje'), '¡Genial!');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByText('¡Genial!')).toBeOnTheScreen();
    expect(api.sendMessage).toHaveBeenCalledWith(expect.anything(), 'u1', 'c1', '¡Genial!');
    expect(screen.getByLabelText('Mensaje').props.value).toBe('');
  });

  it('adds messages that arrive live, once, and marks them as read', async () => {
    const { client, emit } = realtimeClient();
    await renderWith(<ChatView conversationId="c1" />, signedIn({ client }));
    await screen.findByText('Sí, sigue');
    await waitFor(() => expect(api.markRead).toHaveBeenCalledTimes(1));
    const live = {
      action: 'create',
      record: {
        id: 'm9',
        collectionId: 'messages',
        collectionName: 'messages',
        conversation: 'c1',
        sender: 'u2',
        text: '¿Cuándo la ves?',
        created: '2026-11-05 15:40:00.000Z',
      },
    };
    await act(async () => {
      emit('messages', live);
      emit('messages', live);
    });
    expect(await screen.findAllByText('¿Cuándo la ves?')).toHaveLength(1);
    await waitFor(() => expect(api.markRead).toHaveBeenCalledTimes(2));
  });

  it('explains when a block stops the message', async () => {
    jest
      .mocked(api.sendMessage)
      .mockRejectedValue(serverError(400, { conversation: { code: 'blocked', message: 'x' } }));
    await renderWith(<ChatView conversationId="c1" />, signedIn());
    await screen.findByText('Sí, sigue');
    await fireEvent.changeText(screen.getByLabelText('Mensaje'), 'Hola');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByText('No puedes hacerlo porque hay un bloqueo.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Mensaje').props.value).toBe('Hola');
  });

  it('shows who you blocked instead of the field', async () => {
    jest.mocked(moderationApi.listBlocks).mockResolvedValue([{ id: 'b1', blockedId: 'u2' }]);
    await renderWith(<ChatView conversationId="c1" />, signedIn());
    expect(await screen.findByText('Bloqueaste a @sol. No pueden escribirse.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Mensaje')).toBeNull();
  });

  it('reports a message from the other person after confirming', async () => {
    await renderWith(<ChatView conversationId="c1" />, signedIn());
    await fireEvent(await screen.findByLabelText(/^¿Sigue en adopción\?, /), 'longPress');
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/report',
        params: { kind: 'message', id: 'm1' },
      }),
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: '¿Reportar este mensaje?' }),
    );
  });

  it('invites to write when there are no messages yet', async () => {
    jest.mocked(api.listMessages).mockResolvedValue({ items: [], next: null });
    await renderWith(<ChatView conversationId="c1" />, signedIn());
    expect(await screen.findByText('Escríbele a @sol.')).toBeOnTheScreen();
  });
});

describe('profiles and reports', () => {
  beforeEach(() => {
    mockParams = { id: 'u2' };
    jest.mocked(usersApi.getUser).mockResolvedValue(SOL);
    jest.mocked(followsApi.findFollow).mockResolvedValue(null);
    jest.mocked(petsApi.listPets).mockResolvedValue([]);
  });

  it('"Message" opens the conversation', async () => {
    jest.mocked(api.openConversation).mockResolvedValue('c1');
    await renderWith(<UserScreen />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Mensaje' }));
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/messages/[id]',
        params: { id: 'c1' },
      }),
    );
    expect(api.openConversation).toHaveBeenCalledWith(expect.anything(), 'u1', 'u2');
  });

  it('"Message" sends visitors to sign in', async () => {
    await renderWith(<UserScreen />, authValue());
    await fireEvent.press(await screen.findByRole('button', { name: 'Mensaje' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    expect(api.openConversation).not.toHaveBeenCalled();
  });

  it('the report screen asks about the message', async () => {
    mockParams = { kind: 'message', id: 'm1' };
    await renderWith(<ReportScreen />, signedIn());
    expect(screen.getByText('¿Por qué reportas este mensaje?')).toBeOnTheScreen();
  });
});
