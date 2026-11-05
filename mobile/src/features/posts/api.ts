import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import { toUser, type User } from '@/auth/AuthProvider';
import { toPet, type Pet } from '@/features/pets/api';
import { appendFile } from '@/utils/upload';

import type { ComposerMedia } from './media';

export const POSTS = 'posts';
/** Same limits as the server (server/pb_migrations/…_posts.js). */
export const POST_TEXT_MAX = 2200;
export const POST_FILES_MAX = 10;

export type MediaKind = 'photo' | 'video';

export interface Post {
  id: string;
  collectionId: string;
  authorId: string;
  /** Present when the author was expanded. */
  author?: User;
  text: string;
  /** Stored file names, in order. */
  media: string[];
  petIds: string[];
  /** Present when the pets were expanded. */
  pets: Pet[];
  created: string;
}

export interface NewPost {
  text: string;
  media: ComposerMedia[];
  petIds: string[];
}

export interface PostChanges {
  text: string;
  petIds: string[];
}

const VIDEO_EXTENSIONS = ['mp4', 'mov'];

export function mediaKind(fileName: string): MediaKind {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return VIDEO_EXTENSIONS.includes(extension) ? 'video' : 'photo';
}

export function toPost(record: RecordModel): Post {
  const expand = (record.expand ?? {}) as { author?: RecordModel; pets?: RecordModel[] };
  return {
    id: record.id,
    collectionId: record.collectionId,
    authorId: String(record.author ?? ''),
    author: toUser(expand.author) ?? undefined,
    text: String(record.text ?? ''),
    media: Array.isArray(record.media) ? record.media.map(String) : [],
    petIds: Array.isArray(record.pets) ? record.pets.map(String) : [],
    pets: (expand.pets ?? []).map(toPet),
    created: String(record.created ?? ''),
  };
}

/**
 * URL of a post file. Photos use a thumbnail: `1080x0` (feed width) by default or `300x300`
 * for grids. Videos have no thumbnails and always use the original file.
 */
export function mediaUrl(
  client: PocketBase,
  post: Post,
  fileName: string,
  thumb: '1080x0' | '300x300' = '1080x0',
): string {
  return client.files.getURL(
    { id: post.id, collectionId: post.collectionId, collectionName: POSTS },
    fileName,
    mediaKind(fileName) === 'photo' ? { thumb } : undefined,
  );
}

export const POST_EXPAND = 'author,pets';

export async function getPost(client: PocketBase, id: string): Promise<Post> {
  return toPost(await client.collection(POSTS).getOne(id, { expand: POST_EXPAND }));
}

export async function createPost(
  client: PocketBase,
  authorId: string,
  post: NewPost,
): Promise<Post> {
  const data = new FormData();
  data.append('author', authorId);
  data.append('text', post.text.trim());
  for (const petId of post.petIds) data.append('pets', petId);
  for (const file of post.media) {
    await appendFile(data, 'media', file);
  }
  return toPost(await client.collection(POSTS).create(data, { expand: POST_EXPAND }));
}

export async function updatePost(
  client: PocketBase,
  id: string,
  changes: PostChanges,
): Promise<Post> {
  return toPost(
    await client
      .collection(POSTS)
      .update(id, { text: changes.text.trim(), pets: changes.petIds }, { expand: POST_EXPAND }),
  );
}

export async function deletePost(client: PocketBase, id: string): Promise<void> {
  await client.collection(POSTS).delete(id);
}
