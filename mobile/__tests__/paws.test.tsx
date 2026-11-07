import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import type PocketBase from 'pocketbase';
import { AccessibilityInfo, Animated } from 'react-native';

import * as api from '@/features/posts/api';
import { mapPostInCache } from '@/features/posts/cache';
import { FeedList } from '@/features/posts/FeedList';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { notify } from '@/utils/notify';

import { authValue, renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
jest.mock('@/utils/notify', () => ({ notify: jest.fn() }));
jest.mock('expo-haptics', () => ({
  ...jest.requireActual('expo-haptics'),
  impactAsync: jest.fn(async () => undefined),
  performAndroidHapticsAsync: jest.fn(async () => undefined),
}));
jest.mock('@/features/posts/api', () => ({
  ...jest.requireActual('@/features/posts/api'),
  listPosts: jest.fn(),
  addPaw: jest.fn(),
  removePaw: jest.fn(),
}));

const mockRouter = { push: jest.fn() };

const POST: api.Post = {
  id: 'post1',
  collectionId: 'posts',
  authorId: 'u2',
  author: { ...TEST_USER, id: 'u2', username: 'sol' },
  text: 'Mi perrita',
  media: [],
  petIds: [],
  pets: [],
  created: new Date().toISOString(),
  pawCount: 4,
  commentCount: 2,
  pawedByMe: false,
  myPawId: null,
  repostCount: 0,
  repostOfId: null,
  repostedByMe: false,
  myRepostId: null,
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(api.listPosts).mockResolvedValue({ items: [POST], page: 1, hasMore: false });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Whether the paw print button bounced: it grows before going back to its size. */
function bounces(timing: jest.SpyInstance) {
  return timing.mock.calls.filter(([, config]) => config.toValue === 1.4).length;
}

/** A post with one photo, in the feed, with the carousel measured so the photo shows. */
async function feedWithPhoto(auth: Parameters<typeof renderWith>[1], post = POST) {
  jest
    .mocked(api.listPosts)
    .mockResolvedValue({ items: [{ ...post, media: ['foto.jpg'] }], page: 1, hasMore: false });
  await renderWith(<FeedList />, auth);
  await fireEvent(await screen.findByTestId('media-carousel'), 'layout', {
    nativeEvent: { layout: { width: 300, height: 300 } },
  });
  const photo = await screen.findByLabelText('Archivo 1 de 1');
  // The list renders its cells in a batch a moment later.
  await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
  return photo;
}

describe('withMyPaws', () => {
  it("marks the user's paw prints with one request", async () => {
    const getFullList = jest.fn().mockResolvedValue([{ id: 'paw9', post: 'b' }]);
    const client = {
      authStore: { isValid: true, record: { id: 'me' } },
      collection: () => ({ getFullList }),
      filter: (expression: string, params: Record<string, string>) =>
        Object.entries(params).reduce(
          (text, [key, value]) => text.replace(`{:${key}}`, `"${value}"`),
          expression,
        ),
    } as unknown as PocketBase;
    const actual = jest.requireActual<typeof api>('@/features/posts/api');
    const result = await actual.withMyPaws(client, [
      { ...POST, id: 'a' },
      { ...POST, id: 'b' },
    ]);
    expect(getFullList).toHaveBeenCalledWith({
      filter: 'user = "me" && (post = "a" || post = "b")',
      fields: 'id,post',
    });
    expect(result.map((post) => [post.id, post.pawedByMe, post.myPawId])).toEqual([
      ['a', false, null],
      ['b', true, 'paw9'],
    ]);
  });

  it('does nothing for visitors', async () => {
    const getFullList = jest.fn();
    const client = {
      authStore: { isValid: false, record: null },
      collection: () => ({ getFullList }),
    } as unknown as PocketBase;
    const actual = jest.requireActual<typeof api>('@/features/posts/api');
    expect(await actual.withMyPaws(client, [POST])).toEqual([POST]);
    expect(getFullList).not.toHaveBeenCalled();
  });
});

describe('mapPostInCache', () => {
  const change = (post: api.Post) => ({ ...post, pawCount: 99 });

  it('updates a cached detail and cached pages', () => {
    expect(mapPostInCache(POST, 'post1', change).pawCount).toBe(99);
    expect(mapPostInCache(POST, 'other', change).pawCount).toBe(4);
    const pages = { pages: [{ items: [POST], page: 1, hasMore: false }], pageParams: [1] };
    expect(mapPostInCache(pages, 'post1', change).pages[0]?.items[0]?.pawCount).toBe(99);
  });
});

describe('paw print button', () => {
  it('fills the paw and counts it at once, then removes it', async () => {
    jest.mocked(api.addPaw).mockResolvedValue('paw1');
    jest.mocked(api.removePaw).mockResolvedValue(undefined);
    await renderWith(<FeedList />, signedIn());

    await fireEvent.press(await screen.findByRole('button', { name: 'Dar huella' }));
    expect(
      await screen.findByRole('button', { name: 'Quitar tu huella', selected: true }),
    ).toBeOnTheScreen();
    expect(await screen.findByText('5')).toBeOnTheScreen();
    expect(api.addPaw).toHaveBeenCalledWith(expect.anything(), 'u1', 'post1');
    // Let the first request finish (taps on a post that is still saving are ignored).
    await act(async () => {});

    await fireEvent.press(screen.getByRole('button', { name: 'Quitar tu huella' }));
    expect(await screen.findByRole('button', { name: 'Dar huella' })).toBeOnTheScreen();
    expect(await screen.findByText('4')).toBeOnTheScreen();
    await waitFor(() =>
      expect(api.removePaw).toHaveBeenCalledWith(expect.anything(), 'u1', 'post1', 'paw1'),
    );
  });

  it('bounces and vibrates lightly when given, and neither when taken back', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    jest.mocked(api.addPaw).mockResolvedValue('paw1');
    jest.mocked(api.removePaw).mockResolvedValue(undefined);
    await renderWith(<FeedList />, signedIn());
    expect(bounces(timing)).toBe(0);

    await fireEvent.press(await screen.findByRole('button', { name: 'Dar huella' }));
    await screen.findByRole('button', { name: 'Quitar tu huella' });
    expect(bounces(timing)).toBe(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    await act(async () => {});

    await fireEvent.press(screen.getByRole('button', { name: 'Quitar tu huella' }));
    await screen.findByRole('button', { name: 'Dar huella' });
    expect(bounces(timing)).toBe(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('does not bounce with "Reduce motion", but still fills the paw', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    jest.mocked(api.addPaw).mockResolvedValue('paw1');
    await renderWith(<FeedList />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Dar huella' }));
    expect(
      await screen.findByRole('button', { name: 'Quitar tu huella', selected: true }),
    ).toBeOnTheScreen();
    expect(bounces(timing)).toBe(0);
  });

  it('a post already given does not bounce when it shows', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    jest.mocked(api.listPosts).mockResolvedValue({
      items: [{ ...POST, pawedByMe: true, myPawId: 'paw1', pawCount: 5 }],
      page: 1,
      hasMore: false,
    });
    await renderWith(<FeedList />, signedIn());
    expect(await screen.findByRole('button', { name: 'Quitar tu huella' })).toBeOnTheScreen();
    expect(bounces(timing)).toBe(0);
  });

  it('goes back to how it was and explains if saving fails', async () => {
    jest.mocked(api.addPaw).mockRejectedValue(serverError(0));
    await renderWith(<FeedList />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Dar huella' }));
    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(jest.mocked(notify).mock.calls[0]?.[0]).toContain('No se pudo guardar tu huella.');
    expect(await screen.findByRole('button', { name: 'Dar huella' })).toBeOnTheScreen();
    expect(await screen.findByText('4')).toBeOnTheScreen();
  });

  it('sends visitors to sign in', async () => {
    await renderWith(<FeedList />, authValue());
    await fireEvent.press(await screen.findByRole('button', { name: 'Dar huella' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    expect(api.addPaw).not.toHaveBeenCalled();
  });
});

describe('double tap on a photo', () => {
  it('gives the paw print and shows a big paw print; a single tap does nothing', async () => {
    jest.mocked(api.addPaw).mockResolvedValue('paw1');
    const photo = await feedWithPhoto(signedIn());

    await fireEvent.press(photo);
    expect(api.addPaw).not.toHaveBeenCalled();
    expect(screen.queryByTestId('paw-burst', { includeHiddenElements: true })).toBeNull();

    await fireEvent.press(photo);
    expect(
      await screen.findByRole('button', { name: 'Quitar tu huella', selected: true }),
    ).toBeOnTheScreen();
    expect(api.addPaw).toHaveBeenCalledWith(expect.anything(), 'u1', 'post1');
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('paw-burst', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('never takes the paw print back', async () => {
    const photo = await feedWithPhoto(signedIn(), {
      ...POST,
      pawedByMe: true,
      myPawId: 'paw1',
      pawCount: 5,
    });
    await fireEvent.press(photo);
    await fireEvent.press(photo);
    expect(screen.getByTestId('paw-burst', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Quitar tu huella' })).toBeOnTheScreen();
    expect(api.removePaw).not.toHaveBeenCalled();
    expect(api.addPaw).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('sends visitors to sign in, without the big paw print', async () => {
    const photo = await feedWithPhoto(authValue());
    await fireEvent.press(photo);
    await fireEvent.press(photo);
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    expect(screen.queryByTestId('paw-burst', { includeHiddenElements: true })).toBeNull();
    expect(api.addPaw).not.toHaveBeenCalled();
  });

  it('with "Reduce motion" gives the paw print without the big paw print', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.mocked(api.addPaw).mockResolvedValue('paw1');
    const photo = await feedWithPhoto(signedIn());
    await fireEvent.press(photo);
    await fireEvent.press(photo);
    expect(
      await screen.findByRole('button', { name: 'Quitar tu huella', selected: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('paw-burst', { includeHiddenElements: true })).toBeNull();
  });
});
