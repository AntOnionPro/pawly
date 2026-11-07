import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import type PocketBase from 'pocketbase';

import * as petsApi from '@/features/pets/api';
import * as api from '@/features/posts/api';
import { EditPostForm } from '@/features/posts/EditPostForm';
import { checkAsset, formatDuration } from '@/features/posts/media';
import { PostCard } from '@/features/posts/PostCard';
import { PostComposer } from '@/features/posts/PostComposer';
import { PREFERENCES_KEY } from '@/preferences/storage';

import { renderWith, serverError, signedIn, TEST_USER } from '../test-utils/render';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
  useLocales: () => [{ languageCode: 'es', languageTag: 'es-MX' }],
}));
jest.mock('expo-image-picker', () => ({
  ...jest.requireActual('expo-image-picker'),
  launchImageLibraryAsync: jest.fn(),
}));
// Native video playback is not available in tests.
jest.mock('@/features/posts/VideoItem', () => ({ VideoItem: () => null }));
jest.mock('@/features/posts/api', () => ({
  ...jest.requireActual('@/features/posts/api'),
  createPost: jest.fn(),
  updatePost: jest.fn(),
}));
jest.mock('@/features/pets/api', () => ({
  ...jest.requireActual('@/features/pets/api'),
  listPets: jest.fn(),
}));

const LUNA: petsApi.Pet = {
  id: 'p1',
  collectionId: 'pets',
  ownerId: 'u1',
  name: 'Luna',
  species: 'dog',
  breed: '',
  birthDate: '',
  photo: '',
  previousOwnerId: '',
  adoptedAt: '',
};

const POST: api.Post = {
  id: 'post1',
  collectionId: 'posts',
  authorId: 'u1',
  author: TEST_USER,
  text: 'Paseo en Chapultepec',
  media: ['foto_abc.jpg', 'clip_def.mp4'],
  petIds: ['p1'],
  pets: [LUNA],
  created: '2026-11-05 10:00:00.000Z',
  pawCount: 3,
  commentCount: 1,
  pawedByMe: false,
  myPawId: null,
  repostCount: 0,
  repostOfId: null,
  repostedByMe: false,
  myRepostId: null,
};

function asset(overrides: Partial<ImagePicker.ImagePickerAsset>): ImagePicker.ImagePickerAsset {
  return { uri: 'file:///a.jpg', width: 100, height: 100, ...overrides };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(PREFERENCES_KEY, '{"theme":"light","language":"es"}');
  jest.mocked(petsApi.listPets).mockResolvedValue([LUNA]);
});

describe('checkAsset', () => {
  const MB = 1024 * 1024;

  it('accepts photos and videos within the limits', () => {
    const photo = checkAsset(
      asset({ type: 'image', mimeType: 'image/jpeg', fileName: 'IMG_1.JPG', fileSize: 2 * MB }),
      0,
    );
    expect(photo).toEqual({
      ok: true,
      media: { uri: 'file:///a.jpg', name: 'IMG_1.JPG', type: 'image/jpeg', kind: 'photo' },
    });
    const clip = checkAsset(
      asset({ type: 'video', mimeType: 'video/quicktime', fileSize: 20 * MB, duration: 42_000 }),
      3,
    );
    expect(clip.ok && clip.media).toMatchObject({
      kind: 'video',
      type: 'video/quicktime',
      duration: 42,
    });
    expect(clip.ok && clip.media.name).toMatch(/^video-\d+-3\.mov$/);
  });

  it('leaves out files over the limits', () => {
    expect(checkAsset(asset({ type: 'video', duration: 61_000 }), 0)).toEqual({
      ok: false,
      error: 'errors.videoTooLong',
    });
    expect(checkAsset(asset({ type: 'video', duration: 10_000, fileSize: 51 * MB }), 0)).toEqual({
      ok: false,
      error: 'errors.videoTooLarge',
    });
    expect(checkAsset(asset({ type: 'image', fileSize: 11 * MB }), 0)).toEqual({
      ok: false,
      error: 'errors.photoTooLarge',
    });
  });

  it('formats durations', () => {
    expect(formatDuration(42)).toBe('0:42');
    expect(formatDuration(60)).toBe('1:00');
  });
});

describe('post API helpers', () => {
  it('maps records with their author and pets', () => {
    const post = api.toPost({
      id: 'x',
      collectionId: 'c',
      collectionName: 'posts',
      author: 'u1',
      text: 'hola',
      media: ['a.jpg'],
      pets: ['p1'],
      created: '2026-11-05',
      expand: {
        author: { id: 'u1', collectionId: 'u', collectionName: 'users', username: 'sol' },
        pets: [{ id: 'p1', collectionId: 'p', collectionName: 'pets', name: 'Luna', owner: 'u1' }],
      },
    });
    expect(post.author?.username).toBe('sol');
    expect(post.pets.map((pet) => pet.name)).toEqual(['Luna']);
    expect(post.petIds).toEqual(['p1']);
  });

  it('tells photos from videos and only asks thumbnails for photos', () => {
    const getURL = jest.fn((_record, name: string, options?: { thumb?: string }) =>
      options?.thumb ? `${name}?thumb=${options.thumb}` : name,
    );
    const client = { files: { getURL } } as unknown as PocketBase;
    expect(api.mediaKind('a.MOV')).toBe('video');
    expect(api.mediaKind('b.heic')).toBe('photo');
    expect(api.mediaUrl(client, POST, 'foto_abc.jpg')).toBe('foto_abc.jpg?thumb=1080x0');
    expect(api.mediaUrl(client, POST, 'foto_abc.jpg', '300x300')).toBe(
      'foto_abc.jpg?thumb=300x300',
    );
    expect(api.mediaUrl(client, POST, 'clip_def.mp4')).toBe('clip_def.mp4');
  });

  it('sends the author, the trimmed text, the pets and the files', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'n', collectionId: 'c' });
    const client = { collection: () => ({ create }) } as unknown as PocketBase;
    await jest.requireActual<typeof api>('@/features/posts/api').createPost(client, 'u1', {
      text: '  Hola  ',
      petIds: ['p1', 'p2'],
      media: [{ uri: 'file:///a.jpg', name: 'a.jpg', type: 'image/jpeg', kind: 'photo' }],
    });
    const form = create.mock.calls[0]?.[0] as FormData;
    expect(form.get('author')).toBe('u1');
    expect(form.get('text')).toBe('Hola');
    expect(form.getAll('pets')).toEqual(['p1', 'p2']);
    expect(form.getAll('media')).toHaveLength(1);
  });

  it('edits without files as JSON, and with files as a form that removes and adds', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'post1', collectionId: 'c' });
    const client = { collection: () => ({ update }) } as unknown as PocketBase;
    const { updatePost } = jest.requireActual<typeof api>('@/features/posts/api');

    await updatePost(client, 'post1', { text: ' Hola ', petIds: ['p1'] });
    expect(update).toHaveBeenLastCalledWith(
      'post1',
      { text: 'Hola', pets: ['p1'] },
      expect.anything(),
    );

    await updatePost(client, 'post1', {
      text: 'Hola',
      petIds: [],
      removeMedia: ['foto_abc.jpg'],
      addMedia: [{ uri: 'file:///b.mp4', name: 'b.mp4', type: 'video/mp4', kind: 'video' }],
    });
    const form = update.mock.lastCall?.[1] as FormData;
    expect(form.get('text')).toBe('Hola');
    // No pets left: an empty value clears them.
    expect(form.getAll('pets')).toEqual(['']);
    expect(form.getAll('media-')).toEqual(['foto_abc.jpg']);
    expect(form.getAll('media+')).toHaveLength(1);
    expect(form.getAll('media')).toHaveLength(0);
  });
});

describe('PostComposer', () => {
  const MB = 1024 * 1024;

  it('cannot publish an empty post', async () => {
    await renderWith(<PostComposer onPublished={jest.fn()} />, signedIn());
    const publish = await screen.findByRole('button', { name: 'Publicar' });
    expect(publish).toBeDisabled();
    expect(api.createPost).not.toHaveBeenCalled();
  });

  it('adds photos and videos, leaves out the ones over the limits, and publishes', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        asset({ uri: 'file:///1.jpg', type: 'image', mimeType: 'image/jpeg', fileName: '1.jpg' }),
        asset({ uri: 'file:///2.mp4', type: 'video', mimeType: 'video/mp4', duration: 15_000 }),
        asset({ uri: 'file:///3.mp4', type: 'video', mimeType: 'video/mp4', duration: 90_000 }),
        asset({ uri: 'file:///4.jpg', type: 'image', fileSize: 12 * MB }),
      ],
    });
    jest.mocked(api.createPost).mockResolvedValue(POST);
    const onPublished = jest.fn();
    await renderWith(<PostComposer onPublished={onPublished} />, signedIn());

    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar fotos o videos' }));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 10 }),
    );
    expect(screen.getByText('0:15')).toBeOnTheScreen();
    expect(
      screen.getByText('Algunos videos duran más de 60 segundos y no se agregaron.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Algunas fotos pesan más de 10 MB y no se agregaron.'),
    ).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Texto'), 'Paseo con Luna');
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Luna' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar' }));

    expect(api.createPost).toHaveBeenCalledWith(expect.anything(), 'u1', {
      text: 'Paseo con Luna',
      petIds: ['p1'],
      media: [
        expect.objectContaining({ uri: 'file:///1.jpg', kind: 'photo' }),
        expect.objectContaining({ uri: 'file:///2.mp4', kind: 'video', duration: 15 }),
      ],
    });
    expect(onPublished).toHaveBeenCalledWith(POST);
  });

  it('shows who posts and counts the characters only near the limit', async () => {
    await renderWith(<PostComposer onPublished={jest.fn()} />, signedIn());
    expect(await screen.findByText('@luna')).toBeOnTheScreen();
    const text = screen.getByLabelText('Texto');
    expect(text.props.placeholder).toBe('¿Qué quieres compartir?');
    await fireEvent.changeText(text, 'Hola');
    expect(screen.queryByText('4/2200')).toBeNull();
    await fireEvent.changeText(text, 'a'.repeat(2100));
    expect(screen.getByText('2100/2200')).toBeOnTheScreen();
  });

  it('removes a chosen file', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [asset({ type: 'image' }), asset({ uri: 'file:///b.jpg', type: 'image' })],
    });
    await renderWith(<PostComposer onPublished={jest.fn()} />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Agregar fotos o videos' }));
    expect(screen.getByRole('button', { name: 'Quitar el archivo 2' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar el archivo 1' }));
    expect(screen.queryByRole('button', { name: 'Quitar el archivo 2' })).toBeNull();
  });

  it('shows server errors', async () => {
    jest
      .mocked(api.createPost)
      .mockRejectedValue(serverError(400, { media: { code: 'validation_too_many_files' } }));
    await renderWith(<PostComposer onPublished={jest.fn()} />, signedIn());
    await fireEvent.changeText(await screen.findByLabelText('Texto'), 'Hola');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar' }));
    expect(
      screen.getByText('Una publicación puede tener hasta 10 fotos o videos.'),
    ).toBeOnTheScreen();
  });
});

describe('PostCard', () => {
  it('shows the author, the text and the tagged pets', async () => {
    const onPressPet = jest.fn();
    await renderWith(<PostCard post={POST} onPressPet={onPressPet} />, signedIn());
    expect(await screen.findByText('@luna')).toBeOnTheScreen();
    expect(screen.getByText('Paseo en Chapultepec')).toBeOnTheScreen();
    expect(screen.getByText('1/2', { includeHiddenElements: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Luna' }));
    expect(onPressPet).toHaveBeenCalledWith('p1');
    expect(screen.queryByRole('button', { name: 'Editar publicación' })).toBeNull();
  });

  it('shows edit and delete only to the author', async () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    await renderWith(<PostCard post={POST} onEdit={onEdit} onDelete={onDelete} />, signedIn());
    await fireEvent.press(await screen.findByRole('button', { name: 'Editar publicación' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Eliminar publicación' }));
    expect(onEdit).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});

describe('EditPostForm', () => {
  it('saves the new text and pets', async () => {
    jest.mocked(api.updatePost).mockResolvedValue(POST);
    const onSaved = jest.fn();
    await renderWith(<EditPostForm post={POST} onSaved={onSaved} />, signedIn());
    await fireEvent.changeText(await screen.findByLabelText('Texto'), 'Nuevo texto');
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Luna', checked: true }));
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(api.updatePost).toHaveBeenCalledWith(expect.anything(), 'post1', {
      text: 'Nuevo texto',
      petIds: [],
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('removes saved photos and videos and adds new ones', async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [asset({ uri: 'file:///new.jpg', type: 'image', fileName: 'new.jpg' })],
    });
    jest.mocked(api.updatePost).mockResolvedValue(POST);
    const onSaved = jest.fn();
    await renderWith(<EditPostForm post={POST} onSaved={onSaved} />, signedIn());

    // The two saved files show, and there is room for 8 more.
    expect(await screen.findByRole('button', { name: 'Quitar el archivo 2' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar el archivo 1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Agregar fotos o videos' }));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ selectionLimit: 9 }),
    );
    expect(screen.getByRole('button', { name: 'Quitar el archivo 2' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(api.updatePost).toHaveBeenCalledWith(expect.anything(), 'post1', {
      text: 'Paseo en Chapultepec',
      petIds: ['p1'],
      removeMedia: ['foto_abc.jpg'],
      addMedia: [expect.objectContaining({ uri: 'file:///new.jpg', kind: 'photo' })],
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('does not allow leaving a post without text or files', async () => {
    await renderWith(<EditPostForm post={POST} onSaved={jest.fn()} />, signedIn());
    await fireEvent.changeText(await screen.findByLabelText('Texto'), '  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar el archivo 2' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar el archivo 1' }));
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    expect(api.updatePost).not.toHaveBeenCalled();
  });

  it('shows server errors and keeps the changes', async () => {
    jest
      .mocked(api.updatePost)
      .mockRejectedValue(serverError(400, { media: { code: 'validation_too_many_files' } }));
    const onSaved = jest.fn();
    await renderWith(<EditPostForm post={POST} onSaved={onSaved} />, signedIn());
    await fireEvent.changeText(await screen.findByLabelText('Texto'), 'Otro texto');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      screen.getByText('Una publicación puede tener hasta 10 fotos o videos.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Texto').props.value).toBe('Otro texto');
    expect(onSaved).not.toHaveBeenCalled();
  });
});
