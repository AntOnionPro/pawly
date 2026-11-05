import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import type PocketBase from 'pocketbase';

import * as postsApi from '@/features/posts/api';
import { FeedList } from '@/features/posts/FeedList';
import * as api from '@/features/search/api';
import { PREFERENCES_KEY } from '@/preferences/storage';
import SearchScreen from '@/app/search';

import { authValue, renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
jest.mock('@/features/search/api', () => ({
  ...jest.requireActual('@/features/search/api'),
  searchUsers: jest.fn(),
  searchPets: jest.fn(),
}));
jest.mock('@/features/posts/api', () => ({
  ...jest.requireActual('@/features/posts/api'),
  listPosts: jest.fn(),
}));

const mockRouter = { push: jest.fn() };

const SOL = { ...TEST_USER, id: 'u2', username: 'sol', bio: 'Rescatista' };
const MICHI = {
  id: 'p1',
  collectionId: 'pets',
  ownerId: 'u2',
  ownerUsername: 'sol',
  name: 'Michi',
  species: 'cat' as const,
  breed: 'Siamés',
  birthDate: '',
  photo: '',
  previousOwnerId: '',
  adoptedAt: '',
};

function post(id: string, text: string): postsApi.Post {
  return {
    id,
    collectionId: 'posts',
    authorId: 'u2',
    author: SOL,
    text,
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
}

/** Types in the search box and waits for the pause before searching (real timers). */
async function type(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Buscar'), text);
  await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(api.searchUsers).mockResolvedValue({ items: [SOL], page: 1, hasMore: false });
  jest.mocked(api.searchPets).mockResolvedValue({ items: [MICHI], page: 1, hasMore: false });
  jest
    .mocked(postsApi.listPosts)
    .mockResolvedValue({ items: [post('1', 'Michi en el sol')], page: 1, hasMore: false });
});

describe('search API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/search/api');

  function fakeClient(items: unknown[]) {
    const getList = jest.fn().mockResolvedValue({ items });
    const client = {
      collection: () => ({ getList }),
      filter: (expression: string, params: Record<string, string>) =>
        Object.entries(params).reduce(
          (text, [key, value]) => text.replaceAll(`{:${key}}`, `"${value}"`),
          expression,
        ),
    } as unknown as PocketBase;
    return { client, getList };
  }

  it('cleans what is typed', () => {
    expect(actual.cleanQuery('  Lu%na ')).toBe('Luna');
  });

  it('searches users by username', async () => {
    const { client, getList } = fakeClient([{ id: 'u2', collectionId: 'users', username: 'sol' }]);
    const page = await actual.searchUsers(client, 'so', 1, 20);
    expect(getList).toHaveBeenCalledWith(1, 20, {
      filter: 'username ~ "so"',
      sort: 'username',
      skipTotal: true,
    });
    expect(page.items.map((user) => user.username)).toEqual(['sol']);
  });

  it('searches pets by name or breed, with their owner', async () => {
    const { client, getList } = fakeClient([
      { id: 'p1', name: 'Michi', species: 'cat', expand: { owner: { username: 'sol' } } },
    ]);
    const page = await actual.searchPets(client, 'sia', 2, 20);
    expect(getList).toHaveBeenCalledWith(2, 20, {
      filter: 'name ~ "sia" || breed ~ "sia"',
      sort: 'name,id',
      expand: 'owner',
      skipTotal: true,
    });
    expect(page.items[0]?.ownerUsername).toBe('sol');
  });

  it('searches the text of posts, without reposts', async () => {
    const { client, getList } = fakeClient([]);
    const actualPosts = jest.requireActual<typeof postsApi>('@/features/posts/api');
    await actualPosts.listPosts(client, { text: 'playa' }, 1);
    expect(getList).toHaveBeenCalledWith(
      1,
      12,
      expect.objectContaining({ filter: 'text ~ "playa" && repostOf = \'\'' }),
    );
  });
});

describe('search screen', () => {
  it('asks to type, then shows users and opens their profile', async () => {
    await renderWith(<SearchScreen />, signedIn());
    expect(screen.getByRole('tab', { name: 'Usuarios', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Escribe para buscar.')).toBeOnTheScreen();
    expect(api.searchUsers).not.toHaveBeenCalled();

    await type('  So ');
    await fireEvent.press(await screen.findByRole('link', { name: '@sol' }));
    expect(api.searchUsers).toHaveBeenCalledWith(expect.anything(), 'So', 1);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'u2' } });
  });

  it('waits until typing pauses before searching', async () => {
    await renderWith(<SearchScreen />, signedIn());
    jest.useFakeTimers();
    await fireEvent.changeText(screen.getByLabelText('Buscar'), 's');
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    await fireEvent.changeText(screen.getByLabelText('Buscar'), 'so');
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(api.searchUsers).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    jest.useRealTimers();
    await waitFor(() => expect(api.searchUsers).toHaveBeenCalledTimes(1));
    expect(api.searchUsers).toHaveBeenCalledWith(expect.anything(), 'so', 1);
  });

  it('shows pets with their species, breed and owner, and posts in a grid', async () => {
    await renderWith(<SearchScreen />, signedIn());
    await type('michi');
    await fireEvent.press(screen.getByRole('tab', { name: 'Mascotas' }));
    await fireEvent.press(
      await screen.findByRole('link', { name: 'Michi, Gato · Siamés · de @sol' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pet/[id]', params: { id: 'p1' } });

    await fireEvent.press(screen.getByRole('tab', { name: 'Publicaciones' }));
    expect(await screen.findByRole('link', { name: 'Michi en el sol' })).toBeOnTheScreen();
    expect(postsApi.listPosts).toHaveBeenCalledWith(expect.anything(), { text: 'michi' }, 1);
  });

  it('says when nothing matches', async () => {
    jest.mocked(api.searchUsers).mockResolvedValue({ items: [], page: 1, hasMore: false });
    await renderWith(<SearchScreen />, signedIn());
    await type('zzz');
    expect(await screen.findByText('No hay resultados para “zzz”.')).toBeOnTheScreen();
  });

  it('explains errors and retries', async () => {
    jest.mocked(api.searchPets).mockRejectedValueOnce(serverError(0));
    await renderWith(<SearchScreen />, authValue());
    await type('michi');
    await fireEvent.press(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Michi')).toBeOnTheScreen();
  });

  it('lets visitors search pets and posts, and asks them to sign in for users', async () => {
    await renderWith(<SearchScreen />, authValue());
    expect(screen.getByRole('tab', { name: 'Mascotas', selected: true })).toBeOnTheScreen();
    await type('michi');
    expect(await screen.findByText('Michi')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('tab', { name: 'Usuarios' }));
    expect(screen.getByText('Inicia sesión para buscar personas.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    expect(api.searchUsers).not.toHaveBeenCalled();
  });
});

describe('home', () => {
  it('opens search from the top of the feed', async () => {
    await renderWith(<FeedList />, authValue());
    await fireEvent.press(await screen.findByRole('button', { name: 'Buscar' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/search');
  });
});
