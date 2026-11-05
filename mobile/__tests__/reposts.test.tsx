import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type PocketBase from 'pocketbase';
import { Share } from 'react-native';

import { resolveWebUrl } from '@/api/config';
import * as api from '@/features/posts/api';
import { mapPostInCache, removeCachedPost } from '@/features/posts/cache';
import { FeedList } from '@/features/posts/FeedList';
import { PostGrid } from '@/features/posts/PostGrid';
import { postUrl } from '@/features/posts/reposts';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { confirm } from '@/utils/confirm';
import PostDetailScreen from '@/app/post/[id]/index';
import RepostScreen from '@/app/post/[id]/repost';

import { authValue, renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: unknown }) => {
    mockRouter.redirectedTo = href;
    return null;
  },
}));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
jest.mock('@/utils/notify', () => ({ notify: jest.fn() }));
jest.mock('@/features/comments/api', () => ({
  ...jest.requireActual('@/features/comments/api'),
  listComments: jest.fn().mockResolvedValue({ items: [], next: null }),
}));
jest.mock('@/features/posts/api', () => ({
  ...jest.requireActual('@/features/posts/api'),
  listPosts: jest.fn(),
  getPost: jest.fn(),
  addPaw: jest.fn(),
  addRepost: jest.fn(),
  removeRepost: jest.fn(),
}));

const mockRouter: {
  push: jest.Mock;
  back: jest.Mock;
  replace: jest.Mock;
  canGoBack: () => boolean;
  redirectedTo?: unknown;
} = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
let mockParams: Record<string, string> = {};

const SOL = { ...TEST_USER, id: 'u2', username: 'sol' };
const ROCCO = { ...TEST_USER, id: 'u3', username: 'rocco' };

function post(id: string, overrides: Partial<api.Post> = {}): api.Post {
  return {
    id,
    collectionId: 'posts',
    authorId: 'u2',
    author: SOL,
    text: `Publicación ${id}`,
    media: [],
    petIds: [],
    pets: [],
    created: new Date().toISOString(),
    pawCount: 0,
    commentCount: 0,
    repostCount: 1,
    pawedByMe: false,
    myPawId: null,
    repostOfId: null,
    repostedByMe: false,
    myRepostId: null,
    ...overrides,
  };
}

const ORIGINAL = post('orig', { text: 'Perrita en adopción' });

function repostBy(author: typeof TEST_USER, overrides: Partial<api.Post> = {}): api.Post {
  return post(`r-${author.id}`, {
    authorId: author.id,
    author,
    text: '',
    repostCount: 0,
    repostOfId: ORIGINAL.id,
    repostOf: ORIGINAL,
    ...overrides,
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  mockRouter.redirectedTo = undefined;
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(confirm).mockResolvedValue(true);
  jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
});

describe('repost API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/posts/api');

  it('maps a repost with its original', () => {
    const repost = actual.toPost({
      id: 'r1',
      collectionId: 'posts',
      collectionName: 'posts',
      author: 'u3',
      text: 'Compartan',
      repostOf: 'orig',
      expand: {
        repostOf: {
          id: 'orig',
          collectionId: 'posts',
          collectionName: 'posts',
          author: 'u2',
          text: 'Original',
          repostCount: 4,
          expand: { author: { id: 'u2', collectionId: 'users', username: 'sol' } },
        },
      },
    });
    expect(repost.repostOfId).toBe('orig');
    expect(repost.repostOf?.text).toBe('Original');
    expect(repost.repostOf?.repostCount).toBe(4);
    expect(repost.repostOf?.author?.username).toBe('sol');
    expect(actual.targetPost(repost).id).toBe('orig');
  });

  it("marks the user's reposts and paw prints on the originals inside reposts", async () => {
    const getFullList = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'paw1', post: 'orig' }])
      .mockResolvedValueOnce([{ id: 'mine', repostOf: 'orig' }]);
    const client = {
      authStore: { isValid: true, record: { id: 'u1' } },
      collection: () => ({ getFullList }),
      filter: (expression: string, params: Record<string, string>) =>
        Object.entries(params).reduce(
          (text, [key, value]) => text.replace(`{:${key}}`, `"${value}"`),
          expression,
        ),
    } as unknown as PocketBase;
    const marked = await actual.withMyReposts(
      client,
      await actual.withMyPaws(client, [repostBy(ROCCO), ORIGINAL]),
    );
    expect(getFullList).toHaveBeenNthCalledWith(1, {
      filter: 'user = "u1" && (post = "orig")',
      fields: 'id,post',
    });
    expect(getFullList).toHaveBeenNthCalledWith(2, {
      filter: 'author = "u1" && (repostOf = "orig")',
      fields: 'id,repostOf',
    });
    expect(marked[0]?.repostOf).toMatchObject({ pawedByMe: true, repostedByMe: true });
    expect(marked[1]).toMatchObject({ myPawId: 'paw1', myRepostId: 'mine' });
  });

  it('builds share links from the web address', () => {
    expect(resolveWebUrl({ envUrl: 'https://pawly.mx/' })).toBe('https://pawly.mx');
    expect(resolveWebUrl({ hostUri: '192.168.1.20:8081' })).toBe('http://192.168.1.20:8081');
    expect(resolveWebUrl({ webOrigin: 'http://localhost:8081' })).toBe('http://localhost:8081');
    expect(postUrl('abc')).toMatch(/\/post\/abc$/);
  });
});

describe('cache', () => {
  it('updates an original inside a repost and removes undone reposts', () => {
    const change = (item: api.Post) => ({ ...item, pawCount: 9 });
    expect(mapPostInCache(repostBy(ROCCO), 'orig', change).repostOf?.pawCount).toBe(9);

    const queryClient = new QueryClient();
    queryClient.setQueryData(['posts', 'list', { all: true }], {
      pages: [{ items: [repostBy(ROCCO), ORIGINAL], page: 1, hasMore: false }],
      pageParams: [1],
    });
    removeCachedPost(queryClient, 'r-u3');
    const data = queryClient.getQueryData<{ pages: api.PostPage[] }>([
      'posts',
      'list',
      { all: true },
    ]);
    expect(data?.pages[0]?.items.map((item) => item.id)).toEqual(['orig']);
  });
});

describe('reposts in the feed', () => {
  it('shows "@user reposted", the comment and the original, whose buttons act on it', async () => {
    jest.mocked(api.listPosts).mockResolvedValue({
      items: [repostBy(ROCCO, { text: '¡Ayuden a compartir!' })],
      page: 1,
      hasMore: false,
    });
    jest.mocked(api.addPaw).mockResolvedValue('paw1');
    await renderWith(<FeedList />, authValue());
    expect(await screen.findByText('@rocco republicó')).toBeOnTheScreen();
    expect(screen.getByText('¡Ayuden a compartir!')).toBeOnTheScreen();
    expect(screen.getByText('Perrita en adopción')).toBeOnTheScreen();
    // Visitors cannot undo someone else's repost.
    expect(screen.queryByRole('button', { name: 'Deshacer republicación' })).toBeNull();

    await fireEvent.press(screen.getByRole('link', { name: /^Abrir la publicación/ }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/post/[id]',
      params: { id: 'orig' },
    });
  });

  it('lets the user undo their repost from the card', async () => {
    jest
      .mocked(api.listPosts)
      .mockResolvedValue({ items: [repostBy(TEST_USER)], page: 1, hasMore: false });
    jest.mocked(api.removeRepost).mockResolvedValue(undefined);
    await renderWith(<FeedList />, signedIn());
    expect(await screen.findByText('@luna republicó')).toBeOnTheScreen();
    // The server no longer has it when the list is loaded again.
    jest.mocked(api.listPosts).mockResolvedValue({ items: [], page: 1, hasMore: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Deshacer republicación' }));
    await waitFor(() =>
      expect(api.removeRepost).toHaveBeenCalledWith(expect.anything(), 'u1', 'orig', 'r-u1'),
    );
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: '¿Deshacer la republicación?' }),
    );
    await waitFor(() => expect(screen.queryByText('@luna republicó')).toBeNull());
  });
});

describe('repost and share buttons', () => {
  beforeEach(() => {
    jest.mocked(api.listPosts).mockResolvedValue({ items: [ORIGINAL], page: 1, hasMore: false });
  });

  it('sends visitors to sign in to repost, but lets them share', async () => {
    await renderWith(<FeedList />, authValue());
    await fireEvent.press(await screen.findByRole('button', { name: 'Republicar' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');

    await fireEvent.press(screen.getByRole('button', { name: 'Compartir' }));
    await waitFor(() =>
      expect(Share.share).toHaveBeenCalledWith({
        message: 'Mira esta publicación en Pawly',
        url: expect.stringMatching(/\/post\/orig$/),
      }),
    );
  });

  it('opens the repost screen, or asks to undo when already reposted', async () => {
    await renderWith(<FeedList />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Republicar' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/post/[id]/repost',
      params: { id: 'orig' },
    });
  });

  it('undoes a repost from the original after confirming', async () => {
    jest.mocked(api.listPosts).mockResolvedValue({
      items: [{ ...ORIGINAL, repostedByMe: true, myRepostId: 'mine' }],
      page: 1,
      hasMore: false,
    });
    jest.mocked(api.removeRepost).mockResolvedValue(undefined);
    await renderWith(<FeedList />, signedIn());
    const undo = await screen.findByRole('button', {
      name: 'Deshacer republicación',
      selected: true,
    });
    jest.mocked(api.listPosts).mockResolvedValue({ items: [ORIGINAL], page: 1, hasMore: false });
    await fireEvent.press(undo);
    await waitFor(() =>
      expect(api.removeRepost).toHaveBeenCalledWith(expect.anything(), 'u1', 'orig', 'mine'),
    );
    expect(await screen.findByRole('button', { name: 'Republicar' })).toBeOnTheScreen();
  });

  it('does nothing if the undo is cancelled', async () => {
    jest.mocked(confirm).mockResolvedValue(false);
    jest.mocked(api.listPosts).mockResolvedValue({
      items: [{ ...ORIGINAL, repostedByMe: true, myRepostId: 'mine' }],
      page: 1,
      hasMore: false,
    });
    await renderWith(<FeedList />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Deshacer republicación' }));
    expect(api.removeRepost).not.toHaveBeenCalled();
  });
});

describe('repost screen', () => {
  beforeEach(() => {
    mockParams = { id: 'orig' };
    jest.mocked(api.getPost).mockResolvedValue(ORIGINAL);
  });

  it('reposts with an optional comment and goes back', async () => {
    jest.mocked(api.addRepost).mockResolvedValue(repostBy(TEST_USER));
    await renderWith(<RepostScreen />, signedIn());
    expect(await screen.findByText('Perrita en adopción')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Comentario (opcional)'), 'Compartan');
    // The preview of the original also has a (read-only) repost count.
    await fireEvent.press(screen.getByRole('button', { name: 'Republicar', disabled: false }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(api.addRepost).toHaveBeenCalledWith(expect.anything(), 'u1', 'orig', 'Compartan');
  });

  it('explains when the post was already reposted', async () => {
    jest
      .mocked(api.addRepost)
      .mockRejectedValue(
        serverError(400, { repostOf: { code: 'validation_not_unique', message: 'x' } }),
      );
    await renderWith(<RepostScreen />, signedIn());
    await screen.findByText('Perrita en adopción');
    // The preview of the original also has a (read-only) repost count.
    await fireEvent.press(screen.getByRole('button', { name: 'Republicar', disabled: false }));
    expect(await screen.findByText('Ya republicaste esta publicación.')).toBeOnTheScreen();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('sends visitors to sign in', async () => {
    await renderWith(<RepostScreen />, authValue());
    expect(mockRouter.redirectedTo).toBe('/sign-in');
  });
});

describe('post page and grids', () => {
  it('opens the original when the link is to a repost', async () => {
    mockParams = { id: 'r-u3' };
    jest.mocked(api.getPost).mockResolvedValue(repostBy(ROCCO));
    await renderWith(<PostDetailScreen />, authValue());
    await waitFor(() =>
      expect(mockRouter.redirectedTo).toEqual({
        pathname: '/post/[id]',
        params: { id: 'orig' },
      }),
    );
  });

  it('shows reposts in a grid as their original, with a repost mark', async () => {
    jest
      .mocked(api.listPosts)
      .mockResolvedValue({ items: [repostBy(ROCCO)], page: 1, hasMore: false });
    await renderWith(<PostGrid filter={{ authorId: 'u3' }} title="Publicaciones" empty="Nada" />);
    await fireEvent.press(
      await screen.findByRole('link', { name: 'Republicación: Perrita en adopción' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/post/[id]',
      params: { id: 'orig' },
    });
  });
});
