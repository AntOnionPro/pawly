import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import type PocketBase from 'pocketbase';

import * as api from '@/features/comments/api';
import * as postsApi from '@/features/posts/api';
import { PostCard } from '@/features/posts/PostCard';
import { PREFERENCES_KEY } from '@/preferences/storage';
import { confirm } from '@/utils/confirm';
import PostDetailScreen from '@/app/post/[id]/index';

import { authValue, renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: 'post1' }),
}));
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
jest.mock('@/utils/confirm', () => ({ confirm: jest.fn() }));
jest.mock('@/utils/notify', () => ({ notify: jest.fn() }));
jest.mock('@/features/posts/api', () => ({
  ...jest.requireActual('@/features/posts/api'),
  getPost: jest.fn(),
}));
jest.mock('@/features/comments/api', () => ({
  ...jest.requireActual('@/features/comments/api'),
  listComments: jest.fn(),
  addComment: jest.fn(),
  updateComment: jest.fn(),
  deleteComment: jest.fn(),
}));

const mockRouter = { push: jest.fn(), back: jest.fn(), canGoBack: () => true };

const SOL = { ...TEST_USER, id: 'u2', username: 'sol' };
const ROCCO = { ...TEST_USER, id: 'u3', username: 'rocco' };

const POST: postsApi.Post = {
  id: 'post1',
  collectionId: 'posts',
  authorId: 'u2',
  author: SOL,
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

function comment(id: string, author = ROCCO, overrides: Partial<api.Comment> = {}): api.Comment {
  return {
    id,
    postId: 'post1',
    authorId: author.id,
    author,
    text: `Comentario ${id}`,
    created: new Date(Date.now() - 3 * 3600_000).toISOString(),
    edited: false,
    ...overrides,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(postsApi.getPost).mockResolvedValue(POST);
  jest.mocked(api.listComments).mockResolvedValue({
    items: [comment('c1'), comment('c2', TEST_USER)],
    next: null,
  });
  jest.mocked(confirm).mockResolvedValue(true);
});

function commentCount() {
  return within(screen.getByRole('button', { name: 'Comentarios' }));
}

describe('comment API helpers', () => {
  it('maps records and tells edited comments apart', () => {
    const record = {
      id: 'c1',
      collectionId: 'comments',
      collectionName: 'comments',
      post: 'post1',
      author: 'u3',
      text: 'Hola',
      created: '2026-11-05 10:00:00.000Z',
      updated: '2026-11-05 10:00:00.001Z',
      expand: { author: { id: 'u3', collectionId: '_pb_users_auth_', username: 'rocco' } },
    };
    const fresh = jest.requireActual<typeof api>('@/features/comments/api').toComment(record);
    expect(fresh).toMatchObject({ postId: 'post1', authorId: 'u3', text: 'Hola', edited: false });
    expect(fresh.author?.username).toBe('rocco');
    const edited = jest
      .requireActual<typeof api>('@/features/comments/api')
      .toComment({ ...record, updated: '2026-11-05 10:05:00.000Z' });
    expect(edited.edited).toBe(true);
  });

  it('asks for the oldest first and continues after the last comment', async () => {
    const getList = jest.fn().mockResolvedValue({
      items: [
        { id: 'a', post: 'post1', created: '2026-11-05 10:00:00.000Z' },
        { id: 'b', post: 'post1', created: '2026-11-05 11:00:00.000Z' },
      ],
    });
    const client = {
      collection: () => ({ getList }),
      filter: (expression: string, params: Record<string, string>) =>
        Object.entries(params).reduce(
          (text, [key, value]) => text.replaceAll(`{:${key}}`, `"${value}"`),
          expression,
        ),
    } as unknown as PocketBase;
    const { listComments } = jest.requireActual<typeof api>('@/features/comments/api');

    const first = await listComments(client, 'post1', null, 2);
    expect(getList).toHaveBeenCalledWith(1, 2, {
      filter: 'post = "post1"',
      sort: 'created,id',
      expand: 'author',
      skipTotal: true,
    });
    expect(first.next).toEqual({ created: '2026-11-05 11:00:00.000Z', id: 'b' });

    const second = await listComments(client, 'post1', first.next, 3);
    expect(getList).toHaveBeenLastCalledWith(1, 3, {
      filter:
        'post = "post1" && (created > "2026-11-05 11:00:00.000Z" || (created = "2026-11-05 11:00:00.000Z" && id > "b"))',
      sort: 'created,id',
      expand: 'author',
      skipTotal: true,
    });
    expect(second.next).toBeNull();
  });

  it('keeps each comment once, in its later place', () => {
    const pages = [
      { items: [comment('a'), comment('mine')], next: { created: '', id: 'a' } },
      { items: [comment('b'), comment('mine')], next: null },
    ];
    expect(api.flattenComments(pages).map((item) => item.id)).toEqual(['a', 'b', 'mine']);
  });
});

describe('PostCard', () => {
  it('shows the number of comments and opens them', async () => {
    const onComments = jest.fn();
    await renderWith(<PostCard post={POST} onComments={onComments} />);
    const button = screen.getByRole('button', { name: 'Comentarios' });
    expect(within(button).getByText('2')).toBeOnTheScreen();
    await fireEvent.press(button);
    expect(onComments).toHaveBeenCalled();
  });
});

describe('post page comments', () => {
  it('lists the comments oldest first; visitors are sent to sign in to comment', async () => {
    await renderWith(<PostDetailScreen />, authValue());
    expect(await screen.findByText('Comentario c1')).toBeOnTheScreen();
    const texts = screen.getAllByText(/^Comentario c/).map((node) => node.props.children);
    expect(texts).toEqual(['Comentario c1', 'Comentario c2']);
    expect(screen.getByText('@rocco')).toBeOnTheScreen();
    expect(screen.getAllByText(/3 h/).length).toBeGreaterThan(0);
    expect(api.listComments).toHaveBeenCalledWith(expect.anything(), 'post1', null);

    expect(screen.queryByLabelText('Comentario')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar comentario' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Eliminar comentario' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Inicia sesión para comentar' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    await fireEvent.press(screen.getByRole('button', { name: 'Comentarios' }));
    expect(mockRouter.push).toHaveBeenCalledTimes(2);
  });

  it('says when there are no comments yet', async () => {
    jest.mocked(api.listComments).mockResolvedValue({ items: [], next: null });
    await renderWith(<PostDetailScreen />, signedIn());
    expect(await screen.findByText('Todavía no hay comentarios.')).toBeOnTheScreen();
  });

  it('sends a comment, shows it at the end and counts it', async () => {
    jest
      .mocked(api.addComment)
      .mockResolvedValue(comment('c3', TEST_USER, { text: '¡Qué bonita!', created: '' }));
    await renderWith(<PostDetailScreen />, signedIn());
    await screen.findByText('Comentario c1');
    const send = screen.getByRole('button', { name: 'Enviar comentario' });
    expect(send).toBeDisabled();

    const field = screen.getByLabelText('Comentario');
    await fireEvent.changeText(field, '   ');
    expect(send).toBeDisabled();
    await fireEvent.changeText(field, '¡Qué bonita!');
    await fireEvent.press(send);

    expect(await screen.findByText('¡Qué bonita!')).toBeOnTheScreen();
    expect(api.addComment).toHaveBeenCalledWith(expect.anything(), 'u1', 'post1', '¡Qué bonita!');
    expect(field.props.value).toBe('');
    expect(commentCount().getByText('3')).toBeOnTheScreen();
    const texts = screen
      .getAllByText(/^Comentario c|^¡Qué bonita!$/)
      .map((node) => node.props.children);
    expect(texts).toEqual(['Comentario c1', 'Comentario c2', '¡Qué bonita!']);
  });

  it('explains why a comment was not sent and keeps the text', async () => {
    jest
      .mocked(api.addComment)
      .mockRejectedValue(
        serverError(400, { text: { code: 'validation_max_text_constraint', message: 'x' } }),
      );
    await renderWith(<PostDetailScreen />, signedIn());
    await screen.findByText('Comentario c1');
    const field = screen.getByLabelText('Comentario');
    await fireEvent.changeText(field, 'Hola');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar comentario' }));
    expect(await screen.findByText('Este texto es demasiado largo.')).toBeOnTheScreen();
    expect(field.props.value).toBe('Hola');
    expect(commentCount().getByText('2')).toBeOnTheScreen();
  });

  it('explains when the content filter stops a comment, and keeps the text', async () => {
    jest
      .mocked(api.addComment)
      .mockRejectedValue(serverError(400, { text: { code: 'content_blocked', message: 'x' } }));
    await renderWith(<PostDetailScreen />, signedIn());
    await screen.findByText('Comentario c1');
    const field = screen.getByLabelText('Comentario');
    await fireEvent.changeText(field, 'Algo feo');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar comentario' }));
    expect(
      await screen.findByText('Tu texto tiene palabras que no se permiten en Pawly.'),
    ).toBeOnTheScreen();
    expect(field.props.value).toBe('Algo feo');
  });

  it('explains when a limit against spam stops a comment, and keeps the text', async () => {
    jest
      .mocked(api.addComment)
      .mockRejectedValue(serverError(429, { limit: { code: 'rate_limited', message: 'x' } }));
    await renderWith(<PostDetailScreen />, signedIn());
    await screen.findByText('Comentario c1');
    const field = screen.getByLabelText('Comentario');
    await fireEvent.changeText(field, 'Hola otra vez');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar comentario' }));
    expect(
      await screen.findByText('Vas muy rápido. Intenta de nuevo en unos minutos.'),
    ).toBeOnTheScreen();
    expect(field.props.value).toBe('Hola otra vez');
  });

  it('lets the author edit their comment, which then shows as edited', async () => {
    jest
      .mocked(api.updateComment)
      .mockResolvedValue(comment('c2', TEST_USER, { text: 'Corregido', edited: true }));
    await renderWith(<PostDetailScreen />, signedIn());
    await screen.findByText('Comentario c2');
    // Only on their own comment (c2); c1 belongs to someone else on someone else's post.
    expect(screen.getAllByRole('button', { name: 'Editar comentario' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Eliminar comentario' })).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Editar comentario' }));
    const field = screen.getByLabelText('Editar comentario');
    expect(field.props.value).toBe('Comentario c2');
    await fireEvent.changeText(field, ' Corregido ');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Corregido')).toBeOnTheScreen();
    expect(api.updateComment).toHaveBeenCalledWith(expect.anything(), 'c2', ' Corregido ');
    expect(screen.getByText(/editado/)).toBeOnTheScreen();
    expect(screen.queryByDisplayValue(' Corregido ')).toBeNull();
  });

  it('lets the author delete their comment after confirming', async () => {
    jest.mocked(api.deleteComment).mockResolvedValue(undefined);
    await renderWith(<PostDetailScreen />, signedIn());
    await screen.findByText('Comentario c2');
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar comentario' }));
    await waitFor(() => expect(screen.queryByText('Comentario c2')).toBeNull());
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: '¿Eliminar este comentario?', destructive: true }),
    );
    expect(api.deleteComment).toHaveBeenCalledWith(expect.anything(), 'c2');
    expect(commentCount().getByText('1')).toBeOnTheScreen();
  });

  it('keeps the comment if the deletion is cancelled', async () => {
    jest.mocked(confirm).mockResolvedValue(false);
    await renderWith(<PostDetailScreen />, signedIn());
    await screen.findByText('Comentario c2');
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar comentario' }));
    expect(api.deleteComment).not.toHaveBeenCalled();
    expect(screen.getByText('Comentario c2')).toBeOnTheScreen();
  });

  it("lets the post's author delete any comment, but not edit it", async () => {
    jest.mocked(postsApi.getPost).mockResolvedValue({ ...POST, authorId: 'u1', author: TEST_USER });
    jest.mocked(api.listComments).mockResolvedValue({ items: [comment('c1')], next: null });
    await renderWith(<PostDetailScreen />, signedIn());
    await screen.findByText('Comentario c1');
    expect(screen.getByRole('button', { name: 'Eliminar comentario' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Editar comentario' })).toBeNull();
  });

  it('loads more comments after the last one shown', async () => {
    const cursor = { created: '2026-11-05 10:00:00.000Z', id: 'c1' };
    jest
      .mocked(api.listComments)
      .mockResolvedValueOnce({ items: [comment('c1')], next: cursor })
      .mockResolvedValueOnce({ items: [comment('c2')], next: null });
    await renderWith(<PostDetailScreen />, signedIn());
    await screen.findByText('Comentario c1');
    await fireEvent.press(screen.getByRole('button', { name: 'Ver más comentarios' }));
    expect(await screen.findByText('Comentario c2')).toBeOnTheScreen();
    expect(api.listComments).toHaveBeenLastCalledWith(expect.anything(), 'post1', cursor);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Ver más comentarios' })).toBeNull(),
    );
  });
});
