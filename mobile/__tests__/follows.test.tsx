import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type PocketBase from 'pocketbase';

import * as followsApi from '@/features/follows/api';
import { FollowListView } from '@/features/follows/FollowListView';
import * as petsApi from '@/features/pets/api';
import * as postsApi from '@/features/posts/api';
import { FeedList } from '@/features/posts/FeedList';
import * as usersApi from '@/features/users/api';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { notify } from '@/utils/notify';
import ProfileScreen from '@/app/(tabs)/profile';
import UserScreen from '@/app/user/[id]';

import { authValue, renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: 'u2' }),
  Redirect: () => null,
}));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
jest.mock('@/utils/notify', () => ({ notify: jest.fn() }));
jest.mock('@/features/follows/api', () => ({
  ...jest.requireActual('@/features/follows/api'),
  findFollow: jest.fn(),
  follow: jest.fn(),
  unfollow: jest.fn(),
  listFollows: jest.fn(),
}));
jest.mock('@/features/users/api', () => ({
  ...jest.requireActual('@/features/users/api'),
  getUser: jest.fn(),
}));
jest.mock('@/features/pets/api', () => ({
  ...jest.requireActual('@/features/pets/api'),
  listPets: jest.fn(),
}));
jest.mock('@/features/posts/api', () => ({
  ...jest.requireActual('@/features/posts/api'),
  listPosts: jest.fn(),
}));

const mockRouter = { push: jest.fn() };

const SOL = { ...TEST_USER, id: 'u2', username: 'sol', bio: 'Rescatista', followerCount: 3 };
const ROCCO = { ...TEST_USER, id: 'u3', username: 'rocco', bio: '' };

function post(id: string, author = SOL): postsApi.Post {
  return {
    id,
    collectionId: 'posts',
    authorId: author.id,
    author,
    text: `Publicación ${id}`,
    media: [],
    petIds: [],
    pets: [],
    created: new Date().toISOString(),
    pawCount: 0,
    commentCount: 0,
    pawedByMe: false,
    myPawId: null,
    repostCount: 0,
    repostOfId: null,
    repostedByMe: false,
    myRepostId: null,
  };
}

/** Fake PocketBase client that records list requests and fills in filter parameters. */
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

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(usersApi.getUser).mockResolvedValue(SOL);
  jest.mocked(petsApi.listPets).mockResolvedValue([]);
  jest.mocked(postsApi.listPosts).mockResolvedValue({ items: [], page: 1, hasMore: false });
  jest.mocked(followsApi.findFollow).mockResolvedValue(null);
});

describe('follow API helpers', () => {
  const actual = jest.requireActual<typeof followsApi>('@/features/follows/api');

  it('lists followers with their profiles, newest first', async () => {
    const { client, getList } = fakeClient([
      { id: 'f1', expand: { follower: { id: 'u3', collectionId: 'users', username: 'rocco' } } },
    ]);
    const page = await actual.listFollows(client, 'u2', 'followers', 1, 30);
    expect(getList).toHaveBeenCalledWith(1, 30, {
      filter: 'following = "u2"',
      sort: '-created,-id',
      expand: 'follower',
      skipTotal: true,
    });
    expect(page.items.map((user) => user.username)).toEqual(['rocco']);
    expect(page.hasMore).toBe(false);
  });

  it('lists the users someone follows', async () => {
    const { client, getList } = fakeClient([]);
    await actual.listFollows(client, 'u2', 'following', 2, 30);
    expect(getList).toHaveBeenCalledWith(
      2,
      30,
      expect.objectContaining({
        filter: 'follower = "u2"',
        expand: 'following',
      }),
    );
  });

  it('finds whether one user follows another', async () => {
    const { client, getList } = fakeClient([{ id: 'f9' }]);
    expect(await actual.findFollow(client, 'u1', 'u2')).toBe('f9');
    expect(getList).toHaveBeenCalledWith(
      1,
      1,
      expect.objectContaining({
        filter: 'follower = "u1" && following = "u2"',
      }),
    );
  });

  it('asks for the posts of the people a user follows', async () => {
    const { client, getList } = fakeClient([]);
    const actualPosts = jest.requireActual<typeof postsApi>('@/features/posts/api');
    await actualPosts.listPosts(client, { followedBy: 'u1' }, 1);
    expect(getList).toHaveBeenCalledWith(
      1,
      12,
      expect.objectContaining({
        filter: 'author.follows_via_following.follower ?= "u1"',
      }),
    );
  });
});

describe('profile of another user', () => {
  it('shows the counts and follows and unfollows at once', async () => {
    jest.mocked(followsApi.follow).mockResolvedValue('f1');
    jest.mocked(followsApi.unfollow).mockResolvedValue(undefined);
    await renderWith(<UserScreen />, signedIn());

    expect(await screen.findByRole('link', { name: '3 seguidores' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: '0 seguidos' })).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Seguir' }));

    expect(await screen.findByRole('button', { name: 'Siguiendo' })).toBeOnTheScreen();
    expect(await screen.findByRole('link', { name: '4 seguidores' })).toBeOnTheScreen();
    expect(followsApi.follow).toHaveBeenCalledWith(expect.anything(), 'u1', 'u2');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Siguiendo' })).toBeEnabled());

    await fireEvent.press(screen.getByRole('button', { name: 'Siguiendo' }));
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeOnTheScreen();
    expect(await screen.findByRole('link', { name: '3 seguidores' })).toBeOnTheScreen();
    await waitFor(() => expect(followsApi.unfollow).toHaveBeenCalledWith(expect.anything(), 'f1'));
  });

  it('shows that you already follow them', async () => {
    jest.mocked(followsApi.findFollow).mockResolvedValue('f7');
    await renderWith(<UserScreen />, signedIn());
    expect(await screen.findByRole('button', { name: 'Siguiendo' })).toBeOnTheScreen();
    expect(followsApi.findFollow).toHaveBeenCalledWith(expect.anything(), 'u1', 'u2');
  });

  it('goes back and explains if following fails', async () => {
    jest.mocked(followsApi.follow).mockRejectedValue(serverError(0));
    await renderWith(<UserScreen />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Seguir' }));
    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(jest.mocked(notify).mock.calls[0]?.[0]).toContain('No se pudo guardar el cambio.');
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeOnTheScreen();
    expect(await screen.findByRole('link', { name: '3 seguidores' })).toBeOnTheScreen();
  });

  it('sends visitors to sign in', async () => {
    await renderWith(<UserScreen />, authValue());
    await fireEvent.press(await screen.findByRole('button', { name: 'Seguir' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    expect(followsApi.follow).not.toHaveBeenCalled();
    expect(followsApi.findFollow).not.toHaveBeenCalled();
  });

  it('opens the lists of followers and followed users', async () => {
    await renderWith(<UserScreen />, authValue());
    await fireEvent.press(await screen.findByRole('link', { name: '3 seguidores' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/user/[id]/followers',
      params: { id: 'u2' },
    });
    await fireEvent.press(screen.getByRole('link', { name: '0 seguidos' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/user/[id]/following',
      params: { id: 'u2' },
    });
  });
});

describe('own profile', () => {
  it('shows the current counts, not the ones from sign-in', async () => {
    jest.mocked(usersApi.getUser).mockResolvedValue({
      ...TEST_USER,
      followerCount: 1,
      followingCount: 5,
    });
    await renderWith(<ProfileScreen />, signedIn());
    expect(await screen.findByRole('link', { name: '1 seguidor' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: '5 seguidos' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Seguir' })).toBeNull();
  });
});

describe('FollowListView', () => {
  it('lists the users and opens their profiles', async () => {
    jest
      .mocked(followsApi.listFollows)
      .mockResolvedValue({ items: [ROCCO, TEST_USER], page: 1, hasMore: false });
    await renderWith(<FollowListView userId="u2" list="followers" />);
    await fireEvent.press(await screen.findByRole('link', { name: '@rocco' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'u3' } });
    expect(screen.getByText('Tengo una perrita.')).toBeOnTheScreen();
    expect(followsApi.listFollows).toHaveBeenCalledWith(expect.anything(), 'u2', 'followers', 1);
  });

  it('says when there is nobody', async () => {
    jest.mocked(followsApi.listFollows).mockResolvedValue({ items: [], page: 1, hasMore: false });
    await renderWith(<FollowListView userId="u2" list="following" />);
    expect(await screen.findByText('Todavía no sigue a nadie.')).toBeOnTheScreen();
  });
});

describe('home tabs', () => {
  it('starts on Following and invites to Discover when it is empty', async () => {
    await renderWith(<FeedList />, signedIn());
    expect(await screen.findByRole('tab', { name: 'Siguiendo', selected: true })).toBeOnTheScreen();
    expect(
      await screen.findByText('Aquí verás las publicaciones de las personas que sigues.'),
    ).toBeOnTheScreen();
    expect(postsApi.listPosts).toHaveBeenCalledWith(expect.anything(), { followedBy: 'u1' }, 1);

    jest
      .mocked(postsApi.listPosts)
      .mockResolvedValue({ items: [post('1', ROCCO)], page: 1, hasMore: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Ir a Descubrir' }));
    expect(await screen.findByText('Publicación 1')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Descubrir', selected: true })).toBeOnTheScreen();
    expect(postsApi.listPosts).toHaveBeenLastCalledWith(expect.anything(), { all: true }, 1);
  });

  it('switches between the tabs', async () => {
    jest.mocked(postsApi.listPosts).mockImplementation(async (_client, filter) => ({
      items: 'followedBy' in filter ? [post('seguido')] : [post('todos', ROCCO)],
      page: 1,
      hasMore: false,
    }));
    await renderWith(<FeedList />, signedIn());
    expect(await screen.findByText('Publicación seguido')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Descubrir' }));
    expect(await screen.findByText('Publicación todos')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Siguiendo' }));
    expect(await screen.findByText('Publicación seguido')).toBeOnTheScreen();
  });

  it('shows visitors only Discover, without tabs', async () => {
    await renderWith(<FeedList />, authValue());
    await waitFor(() =>
      expect(postsApi.listPosts).toHaveBeenCalledWith(expect.anything(), { all: true }, 1),
    );
    expect(screen.queryByRole('tab')).toBeNull();
  });
});
