import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import type PocketBase from 'pocketbase';

import * as petsApi from '@/features/pets/api';
import * as api from '@/features/posts/api';
import { FeedList } from '@/features/posts/FeedList';
import { PostCard } from '@/features/posts/PostCard';
import { PostGrid } from '@/features/posts/PostGrid';
import * as usersApi from '@/features/users/api';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { relativeTime } from '@/utils/time';
import UserScreen from '@/app/user/[id]';

import { authValue, renderWith, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    mockRouter.redirectedTo = href;
    return null;
  },
}));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
jest.mock('@/features/posts/api', () => ({
  ...jest.requireActual('@/features/posts/api'),
  listPosts: jest.fn(),
}));
jest.mock('@/features/pets/api', () => ({
  ...jest.requireActual('@/features/pets/api'),
  listPets: jest.fn(),
}));
jest.mock('@/features/users/api', () => ({
  ...jest.requireActual('@/features/users/api'),
  getUser: jest.fn(),
}));

const mockRouter: { push: jest.Mock; redirectedTo?: string } = { push: jest.fn() };
let mockParams: Record<string, string> = {};

function post(id: string, overrides: Partial<api.Post> = {}): api.Post {
  return {
    id,
    collectionId: 'posts',
    authorId: 'u2',
    author: { ...TEST_USER, id: 'u2', username: 'sol' },
    text: `Publicación ${id}`,
    media: [],
    petIds: [],
    pets: [],
    created: new Date(Date.now() - 2 * 3600_000).toISOString(),
    pawCount: 0,
    pawedByMe: false,
    myPawId: null,
    ...overrides,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockRouter.redirectedTo = undefined;
  mockParams = {};
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(petsApi.listPets).mockResolvedValue([]);
});

describe('relativeTime', () => {
  const now = new Date('2026-11-05T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it('rounds like social apps do', () => {
    expect(relativeTime(ago(20_000), now)).toEqual({ unit: 'now' });
    expect(relativeTime(ago(5 * 60_000), now)).toEqual({ unit: 'minutes', count: 5 });
    expect(relativeTime(ago(2 * 3600_000), now)).toEqual({ unit: 'hours', count: 2 });
    expect(relativeTime(ago(3 * 86_400_000), now)).toEqual({ unit: 'days', count: 3 });
    expect(relativeTime(ago(8 * 86_400_000), now)).toMatchObject({ unit: 'date' });
  });
});

describe('listPosts', () => {
  it('asks for newest first, with author and pets, and knows if there are more', async () => {
    const getList = jest.fn().mockResolvedValue({
      items: Array.from({ length: 2 }, (_, i) => ({ id: `p${i}`, collectionId: 'c' })),
    });
    const client = {
      collection: () => ({ getList }),
      filter: (expression: string, params: Record<string, string>) =>
        expression.replace('{:id}', `"${params.id}"`),
    } as unknown as PocketBase;
    const actual = jest.requireActual<typeof api>('@/features/posts/api');

    const page = await actual.listPosts(client, { authorId: 'u1' }, 1, 2);
    expect(getList).toHaveBeenCalledWith(1, 2, {
      filter: 'author = "u1"',
      sort: '-created,-id',
      expand: 'author,pets',
      skipTotal: true,
    });
    expect(page.hasMore).toBe(true);

    await actual.listPosts(client, { petId: 'pet9' }, 2, 5);
    expect(getList).toHaveBeenLastCalledWith(
      2,
      5,
      expect.objectContaining({ filter: 'pets ~ "pet9"' }),
    );
    const last = await actual.listPosts(client, { all: true }, 1, 5);
    expect(last.hasMore).toBe(false);
  });
});

describe('PostCard links', () => {
  it('shows a relative date and opens the author and the post', async () => {
    const onPressAuthor = jest.fn();
    const onOpen = jest.fn();
    await renderWith(
      <PostCard post={post('a')} onPressAuthor={onPressAuthor} onOpen={onOpen} />,
      authValue(),
    );
    expect(await screen.findByText('2 h')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: '@sol' }));
    expect(onPressAuthor).toHaveBeenCalledWith('u2');
    await fireEvent.press(screen.getByRole('link', { name: 'Abrir la publicación del 2 h' }));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('FeedList', () => {
  it('shows posts newest first and loads more at the end', async () => {
    jest
      .mocked(api.listPosts)
      .mockResolvedValueOnce({ items: [post('1'), post('2')], page: 1, hasMore: true })
      .mockResolvedValueOnce({ items: [post('3')], page: 2, hasMore: false });
    await renderWith(<FeedList />, authValue());
    expect(await screen.findByText('Publicación 1')).toBeOnTheScreen();
    expect(screen.getByText('Publicación 2')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('feed'), 'onEndReached');
    expect(await screen.findByText('Publicación 3')).toBeOnTheScreen();
    expect(api.listPosts).toHaveBeenLastCalledWith(expect.anything(), { all: true }, 2);
    expect(screen.getByText('Ya viste todo.')).toBeOnTheScreen();
  });

  it('invites to post when the feed is empty', async () => {
    jest.mocked(api.listPosts).mockResolvedValue({ items: [], page: 1, hasMore: false });
    await renderWith(<FeedList />, authValue());
    expect(
      await screen.findByText('Aún no hay publicaciones. Sé el primero en compartir a tu mascota.'),
    ).toBeOnTheScreen();
  });

  it('explains when the server cannot be reached and retries', async () => {
    const { ClientResponseError } = jest.requireActual('pocketbase');
    jest
      .mocked(api.listPosts)
      .mockRejectedValueOnce(new ClientResponseError({ status: 0 }))
      .mockResolvedValueOnce({ items: [post('1')], page: 1, hasMore: false });
    await renderWith(<FeedList />, authValue());
    expect(
      await screen.findByText(
        'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Publicación 1')).toBeOnTheScreen();
  });
});

describe('PostGrid', () => {
  it('shows tiles that open each post, and "show more"', async () => {
    jest
      .mocked(api.listPosts)
      .mockResolvedValueOnce({
        items: [post('1'), post('2', { media: ['clip.mp4'] })],
        page: 1,
        hasMore: true,
      })
      .mockResolvedValueOnce({ items: [post('3')], page: 2, hasMore: false });
    await renderWith(
      <PostGrid filter={{ authorId: 'u2' }} title="Publicaciones" empty="Nada" />,
      authValue(),
    );
    await fireEvent.press(await screen.findByRole('link', { name: 'Publicación 1' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/post/[id]', params: { id: '1' } });
    await fireEvent.press(screen.getByRole('button', { name: 'Ver más' }));
    expect(await screen.findByRole('link', { name: 'Publicación 3' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
  });

  it('shows the empty message', async () => {
    jest.mocked(api.listPosts).mockResolvedValue({ items: [], page: 1, hasMore: false });
    await renderWith(<PostGrid filter={{ petId: 'p1' }} title="Publicaciones" empty="Nada" />);
    expect(await screen.findByText('Nada')).toBeOnTheScreen();
  });
});

describe('UserScreen', () => {
  it("shows another user's profile, pets and posts", async () => {
    mockParams = { id: 'u2' };
    jest
      .mocked(usersApi.getUser)
      .mockResolvedValue({ ...TEST_USER, id: 'u2', username: 'sol', bio: 'Rescatista' });
    jest.mocked(petsApi.listPets).mockResolvedValue([
      {
        id: 'p1',
        collectionId: 'pets',
        ownerId: 'u2',
        name: 'Michi',
        species: 'cat',
        breed: '',
        birthDate: '',
        photo: '',
      },
    ]);
    jest.mocked(api.listPosts).mockResolvedValue({ items: [post('9')], page: 1, hasMore: false });
    await renderWith(<UserScreen />, signedIn());
    expect(await screen.findByText('@sol')).toBeOnTheScreen();
    expect(screen.getByText('Rescatista')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Michi, Gato' })).toBeOnTheScreen();
    expect(await screen.findByRole('link', { name: 'Publicación 9' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Agregar mascota' })).toBeNull();
    expect(api.listPosts).toHaveBeenCalledWith(expect.anything(), { authorId: 'u2' }, 1);
  });

  it('sends you to your own profile tab', async () => {
    mockParams = { id: 'u1' };
    await renderWith(<UserScreen />, signedIn());
    expect(mockRouter.redirectedTo).toBe('/profile');
  });
});
