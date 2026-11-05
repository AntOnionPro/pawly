import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type PocketBase from 'pocketbase';
import type { RecordSubscription } from 'pocketbase';

import * as moderationApi from '@/features/moderation/api';
import * as api from '@/features/notifications/api';
import { NotificationList } from '@/features/notifications/NotificationList';
import { NotificationsButton } from '@/features/notifications/NotificationsButton';
import * as postsApi from '@/features/posts/api';
import { FeedList } from '@/features/posts/FeedList';
import { PREFERENCES_KEY } from '@/preferences/storage';

import { authValue, renderWith, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
jest.mock('@/features/notifications/api', () => ({
  ...jest.requireActual('@/features/notifications/api'),
  listNotifications: jest.fn(),
  countUnreadNotifications: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));
jest.mock('@/features/moderation/api', () => ({
  ...jest.requireActual('@/features/moderation/api'),
  listBlocks: jest.fn(),
}));
jest.mock('@/features/posts/api', () => ({
  ...jest.requireActual('@/features/posts/api'),
  listPosts: jest.fn(),
}));

const mockRouter = { push: jest.fn() };

const SOL = { ...TEST_USER, id: 'u2', username: 'sol', bio: '' };
const ROCCO = { ...TEST_USER, id: 'u3', username: 'rocco', bio: '' };

function notification(
  id: string,
  type: api.NotificationType,
  overrides: Partial<api.AppNotification> = {},
): api.AppNotification {
  return {
    id,
    type,
    actorId: 'u2',
    actor: SOL,
    postId: type === 'follow' ? '' : 'post1',
    commentText: type === 'comment' ? '¡Qué linda!' : '',
    adoptionId: '',
    read: false,
    created: new Date().toISOString(),
    ...overrides,
  };
}

const ALL = [
  notification('n1', 'paw'),
  notification('n2', 'comment'),
  notification('n3', 'follow'),
  notification('n4', 'repost', { read: true }),
];

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(moderationApi.listBlocks).mockResolvedValue([]);
  jest.mocked(api.countUnreadNotifications).mockResolvedValue(0);
  jest.mocked(api.markAllNotificationsRead).mockResolvedValue(undefined);
  jest.mocked(api.listNotifications).mockResolvedValue({ items: ALL, page: 1, hasMore: false });
  jest.mocked(postsApi.listPosts).mockResolvedValue({ items: [], page: 1, hasMore: false });
});

describe('notification API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/notifications/api');

  it('maps a notification with its actor, post and comment', () => {
    const mapped = actual.toNotification({
      id: 'n1',
      collectionId: 'notifications',
      collectionName: 'notifications',
      type: 'comment',
      actor: 'u2',
      post: 'post1',
      read: false,
      expand: {
        actor: { id: 'u2', username: 'sol' },
        post: { id: 'post1', collectionId: 'posts', text: 'Mi perrita', media: ['a.jpg'] },
        comment: { id: 'c1', text: '¡Qué linda!' },
      },
    });
    expect(mapped).toMatchObject({ type: 'comment', postId: 'post1', commentText: '¡Qué linda!' });
    expect(mapped.actor?.username).toBe('sol');
    expect(mapped.post?.media).toEqual(['a.jpg']);
  });

  it('lists, counts and marks as read', async () => {
    const getList = jest.fn().mockResolvedValue({ items: [], totalItems: 4 });
    const send = jest.fn().mockResolvedValue({});
    const client = {
      collection: () => ({ getList }),
      send,
      filter: (expression: string, params: Record<string, string>) =>
        expression.replace('{:me}', `"${params.me}"`),
    } as unknown as PocketBase;
    await actual.listNotifications(client, 'u1', 1, 30);
    expect(getList).toHaveBeenCalledWith(1, 30, {
      filter: 'recipient = "u1"',
      sort: '-created,-id',
      expand: 'actor,post,comment,adoption.pet',
      skipTotal: true,
    });
    expect(await actual.countUnreadNotifications(client, 'u1')).toBe(4);
    expect(getList).toHaveBeenLastCalledWith(1, 1, {
      filter: 'recipient = "u1" && read = false',
      fields: 'id',
    });
    await actual.markAllNotificationsRead(client);
    expect(send).toHaveBeenCalledWith('/api/pawly/notifications/read', { method: 'POST' });
  });
});

describe('bell', () => {
  it('shows the unread count and opens the notifications', async () => {
    jest.mocked(api.countUnreadNotifications).mockResolvedValue(3);
    await renderWith(<NotificationsButton />, signedIn());
    expect(await screen.findByText('3')).toBeOnTheScreen();
    const bell = screen.getByRole('button', { name: 'Notificaciones' });
    expect(bell.props.accessibilityHint).toBe('3 sin leer');
    await fireEvent.press(bell);
    expect(mockRouter.push).toHaveBeenCalledWith('/notifications');
  });

  it('is on Home only with a session', async () => {
    await renderWith(<FeedList />, authValue());
    await screen.findByRole('button', { name: 'Buscar' });
    expect(screen.queryByRole('button', { name: 'Notificaciones' })).toBeNull();
  });
});

describe('notification list', () => {
  it('describes each notification and opens the post or the profile', async () => {
    await renderWith(<NotificationList />, signedIn());
    expect(await screen.findByText('@sol dejó una huella en tu publicación.')).toBeOnTheScreen();
    expect(screen.getByText('@sol comentó: “¡Qué linda!”')).toBeOnTheScreen();
    expect(screen.getByText('@sol empezó a seguirte.')).toBeOnTheScreen();
    expect(screen.getByText('@sol republicó tu publicación.')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: /^Nueva, @sol dejó una huella/ })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: /^@sol republicó/ })).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('@sol dejó una huella en tu publicación.'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/post/[id]',
      params: { id: 'post1' },
    });
    await fireEvent.press(screen.getByText('@sol empezó a seguirte.'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/user/[id]',
      params: { id: 'u2' },
    });
  });

  it('marks them as read once when it opens', async () => {
    await renderWith(<NotificationList />, signedIn());
    await screen.findByText('@sol empezó a seguirte.');
    await waitFor(() => expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1));
  });

  it('does not mark anything when all are read', async () => {
    jest.mocked(api.listNotifications).mockResolvedValue({
      items: [notification('n4', 'repost', { read: true })],
      page: 1,
      hasMore: false,
    });
    await renderWith(<NotificationList />, signedIn());
    await screen.findByText('@sol republicó tu publicación.');
    expect(api.markAllNotificationsRead).not.toHaveBeenCalled();
  });

  it('hides notifications from blocked users and says when there are none', async () => {
    jest.mocked(moderationApi.listBlocks).mockResolvedValue([{ id: 'b1', blockedId: 'u2' }]);
    await renderWith(<NotificationList />, signedIn());
    expect(await screen.findByText('Aún no tienes notificaciones.')).toBeOnTheScreen();
  });

  it('shows new notifications live and marks them as read', async () => {
    let listener: ((event: RecordSubscription) => void) | undefined;
    const client = {
      files: { getURL: () => '' },
      collection: () => ({
        subscribe: jest.fn(async (_topic: string, callback: typeof listener) => {
          listener = callback;
          return async () => undefined;
        }),
      }),
    } as unknown as PocketBase;
    jest.mocked(api.listNotifications).mockResolvedValue({
      items: [notification('n4', 'repost', { read: true })],
      page: 1,
      hasMore: false,
    });
    await renderWith(<NotificationList />, signedIn({ client }));
    await screen.findByText('@sol republicó tu publicación.');
    jest.mocked(api.listNotifications).mockResolvedValue({
      items: [
        notification('n5', 'follow', { actor: ROCCO, actorId: 'u3' }),
        notification('n4', 'repost', { read: true }),
      ],
      page: 1,
      hasMore: false,
    });
    await act(async () => {
      listener?.({ action: 'create', record: { id: 'n5' } } as unknown as RecordSubscription);
    });
    expect(await screen.findByText('@rocco empezó a seguirte.')).toBeOnTheScreen();
    await waitFor(() => expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1));
  });
});
