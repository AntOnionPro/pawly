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

/** Which posts to list: all (feed), by author or by tagged pet. */
export type PostFilter = { all: true } | { authorId: string } | { petId: string };

export interface PostPage {
  items: Post[];
  page: number;
  hasMore: boolean;
}

export const POSTS_PER_PAGE = 12;

function filterExpression(client: PocketBase, filter: PostFilter): string {
  if ('authorId' in filter) return client.filter('author = {:id}', { id: filter.authorId });
  if ('petId' in filter) return client.filter('pets ~ {:id}', { id: filter.petId });
  return '';
}

/** One page of posts, newest first. */
export async function listPosts(
  client: PocketBase,
  filter: PostFilter,
  page: number,
  perPage: number = POSTS_PER_PAGE,
): Promise<PostPage> {
  const result = await client.collection(POSTS).getList(page, perPage, {
    filter: filterExpression(client, filter),
    sort: '-created,-id',
    expand: POST_EXPAND,
    // Counting every post is slow; a full page means there may be more.
    skipTotal: true,
  });
  return { items: result.items.map(toPost), page, hasMore: result.items.length === perPage };
}

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
