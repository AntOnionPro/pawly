import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type PocketBase from 'pocketbase';

import * as commentsApi from '@/features/comments/api';
import * as followsApi from '@/features/follows/api';
import * as api from '@/features/moderation/api';
import * as petsApi from '@/features/pets/api';
import * as postsApi from '@/features/posts/api';
import { FeedList } from '@/features/posts/FeedList';
import * as searchApi from '@/features/search/api';
import * as usersApi from '@/features/users/api';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { confirm } from '@/utils/confirm';
import { notify } from '@/utils/notify';
import BlockedScreen from '@/app/blocked';
import PostDetailScreen from '@/app/post/[id]/index';
import ReportScreen from '@/app/report';
import SearchScreen from '@/app/search';
import UserScreen from '@/app/user/[id]';

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
jest.mock('@/features/moderation/api', () => ({
  ...jest.requireActual('@/features/moderation/api'),
  sendReport: jest.fn(),
  listBlocks: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
}));
jest.mock('@/features/posts/api', () => ({
  ...jest.requireActual('@/features/posts/api'),
  listPosts: jest.fn(),
  getPost: jest.fn(),
}));
jest.mock('@/features/comments/api', () => ({
  ...jest.requireActual('@/features/comments/api'),
  listComments: jest.fn(),
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
jest.mock('@/features/search/api', () => ({
  ...jest.requireActual('@/features/search/api'),
  searchUsers: jest.fn(),
}));

const mockRouter: {
  push: jest.Mock;
  back: jest.Mock;
  replace: jest.Mock;
  canGoBack: () => boolean;
  redirectedTo?: unknown;
} = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
let mockParams: Record<string, string> = {};

const SOL = { ...TEST_USER, id: 'u2', username: 'sol', bio: '' };
const ROCCO = { ...TEST_USER, id: 'u3', username: 'rocco', bio: '' };

function post(id: string, author = SOL): postsApi.Post {
  return {
    id,
    collectionId: 'posts',
    authorId: author.id,
    author,
    text: `Publicación de ${author.username}`,
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

function comment(id: string, author = SOL): commentsApi.Comment {
  return {
    id,
    postId: 'p-u3',
    authorId: author.id,
    author,
    text: `Comentario de ${author.username}`,
    created: new Date().toISOString(),
    edited: false,
  };
}

const BLOCK_SOL: api.Block = { id: 'b1', blockedId: 'u2', blocked: SOL };

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  mockRouter.redirectedTo = undefined;
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(confirm).mockResolvedValue(true);
  jest.mocked(api.listBlocks).mockResolvedValue([]);
  jest.mocked(followsApi.findFollow).mockResolvedValue(null);
  jest.mocked(petsApi.listPets).mockResolvedValue([]);
  jest.mocked(usersApi.getUser).mockResolvedValue(SOL);
  jest.mocked(postsApi.listPosts).mockResolvedValue({ items: [], page: 1, hasMore: false });
});

describe('moderation API helpers', () => {
  const actual = jest.requireActual<typeof api>('@/features/moderation/api');

  it('sends a report about one post, comment or user', async () => {
    const create = jest.fn().mockResolvedValue({});
    const client = { collection: () => ({ create }) } as unknown as PocketBase;
    await actual.sendReport(client, 'u1', { kind: 'comment', id: 'c1' }, 'offensive', '  Feo ');
    expect(create).toHaveBeenCalledWith({
      reporter: 'u1',
      comment: 'c1',
      reason: 'offensive',
      details: 'Feo',
    });
  });

  it('recognizes a repeated report', () => {
    const repeated = serverError(400, { post: { code: 'validation_not_unique', message: 'x' } });
    expect(actual.isAlreadyReported(repeated)).toBe(true);
    expect(actual.isAlreadyReported(serverError(0))).toBe(false);
  });

  it('lists the blocked users with their profiles', async () => {
    const getFullList = jest
      .fn()
      .mockResolvedValue([
        { id: 'b1', blocked: 'u2', expand: { blocked: { id: 'u2', username: 'sol' } } },
      ]);
    const client = {
      collection: () => ({ getFullList }),
      filter: (expression: string, params: Record<string, string>) =>
        expression.replace('{:blocker}', `"${params.blocker}"`),
    } as unknown as PocketBase;
    const blocks = await actual.listBlocks(client, 'u1');
    expect(getFullList).toHaveBeenCalledWith({
      filter: 'blocker = "u1"',
      sort: '-created,-id',
      expand: 'blocked',
    });
    expect(blocks[0]).toMatchObject({ id: 'b1', blockedId: 'u2' });
    expect(blocks[0]?.blocked?.username).toBe('sol');
  });
});

describe('report screen', () => {
  beforeEach(() => {
    mockParams = { kind: 'post', id: 'post1' };
  });

  it('asks for a reason, sends the report and confirms it', async () => {
    jest.mocked(api.sendReport).mockResolvedValue(undefined);
    await renderWith(<ReportScreen />, signedIn());
    expect(screen.getByText('¿Por qué reportas esta publicación?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(screen.getByText('Elige un motivo.')).toBeOnTheScreen();
    expect(api.sendReport).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Venta de animales'));
    await fireEvent.changeText(screen.getByLabelText('Detalles (opcional)'), 'Vende cachorros');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(api.sendReport).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      { kind: 'post', id: 'post1' },
      'animal_sale',
      'Vende cachorros',
    );
    expect(notify).toHaveBeenCalledWith('Gracias. Recibimos tu reporte y lo revisaremos.');
  });

  it('explains when it was already reported', async () => {
    jest
      .mocked(api.sendReport)
      .mockRejectedValue(
        serverError(400, { post: { code: 'validation_not_unique', message: 'x' } }),
      );
    await renderWith(<ReportScreen />, signedIn());
    await fireEvent.press(screen.getByLabelText('Spam'));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(await screen.findByText('Ya reportaste esto.')).toBeOnTheScreen();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('reports adoption listings too', async () => {
    jest.mocked(api.sendReport).mockResolvedValue(undefined);
    mockParams = { kind: 'adoption', id: 'a1' };
    await renderWith(<ReportScreen />, signedIn());
    expect(screen.getByText('¿Por qué reportas esta ficha de adopción?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Venta de animales'));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar reporte' }));
    await waitFor(() =>
      expect(api.sendReport).toHaveBeenCalledWith(
        expect.anything(),
        'u1',
        { kind: 'adoption', id: 'a1' },
        'animal_sale',
        '',
      ),
    );
  });

  it('reports rescue cases too', async () => {
    mockParams = { kind: 'rescue', id: 'r1' };
    await renderWith(<ReportScreen />, signedIn());
    expect(screen.getByText('¿Por qué reportas este caso de rescate?')).toBeOnTheScreen();
  });

  it('sends visitors to sign in', async () => {
    await renderWith(<ReportScreen />, authValue());
    expect(mockRouter.redirectedTo).toBe('/sign-in');
  });
});

describe('report buttons', () => {
  it("are on other people's posts, not on your own", async () => {
    jest.mocked(postsApi.listPosts).mockResolvedValue({
      items: [post('p-u2'), post('p-u1', TEST_USER)],
      page: 1,
      hasMore: false,
    });
    await renderWith(<FeedList />, signedIn());
    await fireEvent.press(screen.getByRole('tab', { name: 'Descubrir' }));
    const buttons = await screen.findAllByRole('button', { name: 'Reportar publicación' });
    expect(buttons).toHaveLength(1);
    await fireEvent.press(buttons[0]!);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/report',
      params: { kind: 'post', id: 'p-u2' },
    });
  });

  it("are on other people's comments, and send visitors to sign in", async () => {
    mockParams = { id: 'p-u3' };
    jest.mocked(postsApi.getPost).mockResolvedValue(post('p-u3', ROCCO));
    jest.mocked(commentsApi.listComments).mockResolvedValue({
      items: [comment('c1'), comment('c2', TEST_USER)],
      next: null,
    });
    await renderWith(<PostDetailScreen />, signedIn());
    const buttons = await screen.findAllByRole('button', { name: 'Reportar comentario' });
    expect(buttons).toHaveLength(1);
    await fireEvent.press(buttons[0]!);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/report',
      params: { kind: 'comment', id: 'c1' },
    });
  });

  it('send visitors to sign in', async () => {
    mockParams = { id: 'p-u3' };
    jest.mocked(postsApi.getPost).mockResolvedValue(post('p-u3', ROCCO));
    jest.mocked(commentsApi.listComments).mockResolvedValue({ items: [], next: null });
    await renderWith(<PostDetailScreen />, authValue());
    await fireEvent.press(await screen.findByRole('button', { name: 'Reportar publicación' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
  });
});

describe('profiles', () => {
  beforeEach(() => {
    mockParams = { id: 'u2' };
  });

  it('report the user', async () => {
    await renderWith(<UserScreen />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Reportar' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/report',
      params: { kind: 'user', id: 'u2' },
    });
  });

  it('block after confirming, then show the blocked state and unblock', async () => {
    jest.mocked(api.blockUser).mockResolvedValue(undefined);
    jest.mocked(api.unblockUser).mockResolvedValue(undefined);
    await renderWith(<UserScreen />, signedIn());
    const blockButton = await screen.findByRole('button', { name: 'Bloquear' });
    // From now on the server has the block.
    jest.mocked(api.listBlocks).mockResolvedValue([BLOCK_SOL]);
    await fireEvent.press(blockButton);

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: '¿Bloquear a @sol?', destructive: true }),
    );
    expect(await screen.findByText('Bloqueaste a @sol. No verás su contenido.')).toBeOnTheScreen();
    expect(api.blockUser).toHaveBeenCalledWith(expect.anything(), 'u1', 'u2');
    expect(screen.queryByRole('button', { name: 'Seguir' })).toBeNull();

    jest.mocked(api.listBlocks).mockResolvedValue([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Desbloquear' }));
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeOnTheScreen();
    expect(api.unblockUser).toHaveBeenCalledWith(expect.anything(), 'b1');
  });

  it('do not block if cancelled', async () => {
    jest.mocked(confirm).mockResolvedValue(false);
    await renderWith(<UserScreen />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Bloquear' }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(api.blockUser).not.toHaveBeenCalled();
  });

  it('send visitors to sign in to block', async () => {
    await renderWith(<UserScreen />, authValue());
    await fireEvent.press(await screen.findByRole('button', { name: 'Bloquear' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('hiding blocked users', () => {
  beforeEach(() => {
    jest.mocked(api.listBlocks).mockResolvedValue([BLOCK_SOL]);
  });

  it('in the feed', async () => {
    jest.mocked(postsApi.listPosts).mockResolvedValue({
      items: [post('p-u2'), post('p-u3', ROCCO)],
      page: 1,
      hasMore: false,
    });
    await renderWith(<FeedList />, signedIn());
    expect(await screen.findByText('Publicación de rocco')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByText('Publicación de sol')).toBeNull());
  });

  it('in the comments', async () => {
    mockParams = { id: 'p-u3' };
    jest.mocked(postsApi.getPost).mockResolvedValue(post('p-u3', ROCCO));
    jest.mocked(commentsApi.listComments).mockResolvedValue({
      items: [comment('c1'), comment('c2', ROCCO)],
      next: null,
    });
    await renderWith(<PostDetailScreen />, signedIn());
    expect(await screen.findByText('Comentario de rocco')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByText('Comentario de sol')).toBeNull());
  });

  it('in the search', async () => {
    jest
      .mocked(searchApi.searchUsers)
      .mockResolvedValue({ items: [SOL, ROCCO], page: 1, hasMore: false });
    await renderWith(<SearchScreen />, signedIn());
    await fireEvent.changeText(screen.getByLabelText('Buscar'), 'o');
    expect(await screen.findByRole('link', { name: '@rocco' })).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: '@sol' })).toBeNull();
  });
});

describe('blocked users screen', () => {
  it('lists blocked users and unblocks them', async () => {
    jest.mocked(api.listBlocks).mockResolvedValue([BLOCK_SOL]);
    jest.mocked(api.unblockUser).mockResolvedValue(undefined);
    await renderWith(<BlockedScreen />, signedIn());
    expect(await screen.findByRole('link', { name: '@sol' })).toBeOnTheScreen();
    jest.mocked(api.listBlocks).mockResolvedValue([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Desbloquear' }));
    expect(await screen.findByText('No has bloqueado a nadie.')).toBeOnTheScreen();
    expect(api.unblockUser).toHaveBeenCalledWith(expect.anything(), 'b1');
  });

  it('sends visitors to sign in', async () => {
    await renderWith(<BlockedScreen />, authValue());
    expect(mockRouter.redirectedTo).toBe('/sign-in');
  });
});
