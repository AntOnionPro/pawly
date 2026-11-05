import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type PocketBase from 'pocketbase';
import { Share } from 'react-native';

import { ChatView } from '@/features/messages/ChatView';
import { ConversationList } from '@/features/messages/ConversationList';
import * as api from '@/features/messages/api';
import { SharePostView } from '@/features/messages/SharePostView';
import * as moderationApi from '@/features/moderation/api';
import * as postsApi from '@/features/posts/api';
import { FeedList } from '@/features/posts/FeedList';
import * as searchApi from '@/features/search/api';
import { PREFERENCES_KEY } from '@/preferences/storage';

import { authValue, renderWith, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, Redirect: () => null }));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
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
jest.mock('@/features/posts/api', () => ({
  ...jest.requireActual('@/features/posts/api'),
  listPosts: jest.fn(),
  getPost: jest.fn(),
}));
jest.mock('@/features/search/api', () => ({
  ...jest.requireActual('@/features/search/api'),
  searchUsers: jest.fn(),
}));

const mockRouter = { push: jest.fn() };

const SOL = { ...TEST_USER, id: 'u2', username: 'sol', bio: '' };
const ROCCO = { ...TEST_USER, id: 'u3', username: 'rocco', bio: '' };

const POST: postsApi.Post = {
  id: 'orig',
  collectionId: 'posts',
  authorId: 'u3',
  author: ROCCO,
  text: 'Firulais busca casa',
  media: [],
  petIds: [],
  pets: [],
  created: new Date().toISOString(),
  pawCount: 0,
  commentCount: 0,
  repostCount: 0,
  pawedByMe: false,
  myPawId: null,
  repostOfId: null,
  repostedByMe: false,
  myRepostId: null,
};

function conversation(id: string, other: typeof SOL, text = 'Hola'): api.Conversation {
  return {
    id,
    otherId: other.id,
    other,
    lastMessageText: text,
    lastMessageAt: new Date().toISOString(),
    lastSenderId: other.id,
    unread: false,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(moderationApi.listBlocks).mockResolvedValue([]);
  jest.mocked(api.countUnread).mockResolvedValue(0);
  jest.mocked(api.markRead).mockResolvedValue(undefined);
  jest.mocked(postsApi.getPost).mockResolvedValue(POST);
  jest
    .mocked(api.listConversations)
    .mockResolvedValue({ items: [conversation('c1', SOL)], page: 1, hasMore: false });
  jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
});

describe('API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/messages/api');

  it('maps a message that shares a post', () => {
    const message = actual.toMessage({
      id: 'm1',
      collectionId: 'messages',
      collectionName: 'messages',
      conversation: 'c1',
      sender: 'u1',
      text: '',
      hasPost: true,
      post: 'orig',
      expand: {
        post: {
          id: 'orig',
          collectionId: 'posts',
          collectionName: 'posts',
          author: 'u3',
          text: 'Firulais busca casa',
          expand: { author: { id: 'u3', username: 'rocco' } },
        },
      },
    });
    expect(message.hasPost).toBe(true);
    expect(message.post?.text).toBe('Firulais busca casa');
    expect(message.post?.author?.username).toBe('rocco');
  });

  it('sends the post with an optional note', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'm1' });
    const client = { collection: () => ({ create }) } as unknown as PocketBase;
    await actual.sendMessage(client, 'u1', 'c1', ' Mira ', 'orig');
    expect(create).toHaveBeenCalledWith(
      { conversation: 'c1', sender: 'u1', text: 'Mira', post: 'orig' },
      { expand: 'post,post.author' },
    );
  });
});

describe('share button', () => {
  beforeEach(() => {
    jest.mocked(postsApi.listPosts).mockResolvedValue({ items: [POST], page: 1, hasMore: false });
  });

  it('opens the share screen for users', async () => {
    await renderWith(<FeedList />, signedIn());
    await fireEvent.press(screen.getByRole('tab', { name: 'Descubrir' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Compartir' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/post/[id]/send',
      params: { id: 'orig' },
    });
    expect(Share.share).not.toHaveBeenCalled();
  });

  it('shares outside directly for visitors', async () => {
    await renderWith(<FeedList />, authValue());
    await fireEvent.press(await screen.findByRole('button', { name: 'Compartir' }));
    await waitFor(() => expect(Share.share).toHaveBeenCalled());
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('share screen', () => {
  it('sends the post to a recent conversation, with the note', async () => {
    jest.mocked(api.openConversation).mockResolvedValue('c1');
    jest.mocked(api.sendMessage).mockResolvedValue({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u1',
      text: 'Mira',
      created: '',
      hasPost: true,
      post: POST,
    });
    await renderWith(<SharePostView postId="orig" />, signedIn());
    expect(await screen.findByText('@sol')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Mensaje (opcional)'), 'Mira');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('button', { name: 'Enviado' })).toBeDisabled();
    expect(api.openConversation).toHaveBeenCalledWith(expect.anything(), 'u1', 'u2');
    expect(api.sendMessage).toHaveBeenCalledWith(expect.anything(), 'u1', 'c1', 'Mira', 'orig');
  });

  it('finds other people by username, without blocked users', async () => {
    jest.mocked(moderationApi.listBlocks).mockResolvedValue([{ id: 'b1', blockedId: 'u3' }]);
    jest.mocked(searchApi.searchUsers).mockResolvedValue({
      items: [ROCCO, { ...SOL, id: 'u4', username: 'solecito' }],
      page: 1,
      hasMore: false,
    });
    await renderWith(<SharePostView postId="orig" />, signedIn());
    await screen.findByText('@sol');
    await fireEvent.changeText(screen.getByLabelText('Buscar personas'), 'so');
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(await screen.findByText('@solecito')).toBeOnTheScreen();
    expect(screen.queryByText('@rocco')).toBeNull();
  });

  it('shares outside Pawly too', async () => {
    await renderWith(<SharePostView postId="orig" />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Compartir fuera de Pawly' }));
    await waitFor(() =>
      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringMatching(/\/post\/orig$/) }),
      ),
    );
  });

  it('invites to search when there are no conversations', async () => {
    jest.mocked(api.listConversations).mockResolvedValue({ items: [], page: 1, hasMore: false });
    await renderWith(<SharePostView postId="orig" />, signedIn());
    expect(
      await screen.findByText('Busca a alguien para enviarle la publicación.'),
    ).toBeOnTheScreen();
  });
});

describe('shared posts in conversations', () => {
  it('show a card that opens the post, or say it is gone', async () => {
    jest.mocked(api.getConversation).mockResolvedValue(conversation('c1', SOL));
    jest.mocked(api.listMessages).mockResolvedValue({
      items: [
        { id: 'm2', conversationId: 'c1', senderId: 'u2', text: '', created: '', hasPost: true },
        {
          id: 'm1',
          conversationId: 'c1',
          senderId: 'u2',
          text: '¡Mira!',
          created: '',
          hasPost: true,
          post: POST,
        },
      ],
      next: null,
    });
    await renderWith(<ChatView conversationId="c1" />, signedIn());
    expect(await screen.findByText('Publicación no disponible')).toBeOnTheScreen();
    expect(screen.getByText('¡Mira!')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Abrir la publicación de @rocco' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/post/[id]',
      params: { id: 'orig' },
    });
  });

  it('preview as "shared a post" in the list', async () => {
    jest.mocked(api.listConversations).mockResolvedValue({
      items: [conversation('c1', SOL, '')],
      page: 1,
      hasMore: false,
    });
    await renderWith(<ConversationList />, signedIn());
    expect(await screen.findByText('Compartió una publicación')).toBeOnTheScreen();
  });
});
