import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import { toUser, type User } from '@/auth/AuthProvider';
import { toPet, type Pet } from '@/features/pets/api';
import { appendFile, uploadFetch } from '@/utils/upload';

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
  pawCount: number;
  commentCount: number;
  repostCount: number;
  /** Whether the signed-in user left a paw print, and its id (to remove it). */
  pawedByMe: boolean;
  myPawId: string | null;
  /** For a repost: the id of the original post, and the original when it was expanded. */
  repostOfId: string | null;
  repostOf?: Post;
  /** Whether the signed-in user reposted it, and the id of their repost (to undo it). */
  repostedByMe: boolean;
  myRepostId: string | null;
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
  const expand = (record.expand ?? {}) as {
    author?: RecordModel;
    pets?: RecordModel[];
    repostOf?: RecordModel;
  };
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
    pawCount: Number(record.pawCount ?? 0),
    commentCount: Number(record.commentCount ?? 0),
    repostCount: Number(record.repostCount ?? 0),
    pawedByMe: false,
    myPawId: null,
    repostOfId: record.repostOf ? String(record.repostOf) : null,
    repostOf: expand.repostOf ? toPost(expand.repostOf) : undefined,
    repostedByMe: false,
    myRepostId: null,
  };
}

/** The post the buttons of `post` act on: the original for a repost, or the post itself. */
export function targetPost(post: Post): Post {
  return post.repostOf ?? post;
}

/** Applies `change` to the posts the buttons act on (originals inside reposts included). */
function mapTargets(posts: Post[], change: (post: Post) => Post): Post[] {
  return posts.map((post) =>
    post.repostOf ? { ...post, repostOf: change(post.repostOf) } : change(post),
  );
}

/** Filter that matches `field` against the ids of the posts the buttons act on. */
function targetFilter(client: PocketBase, field: string, posts: Post[]): string {
  const ids = [...new Set(posts.map((post) => targetPost(post).id))];
  return ids
    .map((id, index) => client.filter(`${field} = {:p${index}}`, { [`p${index}`]: id }))
    .join(' || ');
}

function signedInUserId(client: PocketBase): string | undefined {
  return client.authStore?.isValid ? client.authStore.record?.id : undefined;
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

export const POST_EXPAND = 'author,pets,repostOf,repostOf.author,repostOf.pets';

export const PAWS = 'paws';

/** Marks the posts the signed-in user left a paw print on (one request for the whole list). */
export async function withMyPaws(client: PocketBase, posts: Post[]): Promise<Post[]> {
  const userId = signedInUserId(client);
  if (!userId || posts.length === 0) return posts;
  const paws = await client.collection(PAWS).getFullList({
    filter: `${client.filter('user = {:user}', { user: userId })} && (${targetFilter(client, 'post', posts)})`,
    fields: 'id,post',
  });
  const byPost = new Map(paws.map((paw) => [String(paw.post), paw.id]));
  return mapTargets(posts, (post) => {
    const pawId = byPost.get(post.id) ?? null;
    return { ...post, pawedByMe: pawId !== null, myPawId: pawId };
  });
}

/** Marks the posts the signed-in user reposted (one request for the whole list). */
export async function withMyReposts(client: PocketBase, posts: Post[]): Promise<Post[]> {
  const userId = signedInUserId(client);
  if (!userId || posts.length === 0) return posts;
  const reposts = await client.collection(POSTS).getFullList({
    filter: `${client.filter('author = {:user}', { user: userId })} && (${targetFilter(client, 'repostOf', posts)})`,
    fields: 'id,repostOf',
  });
  const byPost = new Map(reposts.map((repost) => [String(repost.repostOf), repost.id]));
  return mapTargets(posts, (post) => {
    const repostId = byPost.get(post.id) ?? null;
    return { ...post, repostedByMe: repostId !== null, myRepostId: repostId };
  });
}

/** Adds what the signed-in user did with each post: paw prints and reposts. */
async function withMine(client: PocketBase, posts: Post[]): Promise<Post[]> {
  return withMyReposts(client, await withMyPaws(client, posts));
}

/** Leaves a paw print. Returns its id. */
export async function addPaw(client: PocketBase, userId: string, postId: string): Promise<string> {
  const paw = await client.collection(PAWS).create({ user: userId, post: postId });
  return paw.id;
}

/** Removes the user's paw print from a post (looks it up if the id is not known yet). */
export async function removePaw(
  client: PocketBase,
  userId: string,
  postId: string,
  pawId: string | null,
): Promise<void> {
  const id =
    pawId ??
    (
      await client
        .collection(PAWS)
        .getFirstListItem(
          client.filter('user = {:user} && post = {:post}', { user: userId, post: postId }),
        )
    ).id;
  await client.collection(PAWS).delete(id);
}

/**
 * Which posts to list: all (Discover, without reposts), by the people a user follows
 * (Following), by author, by tagged pet, or whose text contains a search (without reposts).
 */
export type PostFilter =
  | { all: true }
  | { text: string }
  | { followedBy: string }
  | { authorId: string }
  | { petId: string };

export interface PostPage {
  items: Post[];
  page: number;
  hasMore: boolean;
}

export const POSTS_PER_PAGE = 12;

function filterExpression(client: PocketBase, filter: PostFilter): string {
  if ('authorId' in filter) return client.filter('author = {:id}', { id: filter.authorId });
  if ('petId' in filter) return client.filter('pets ~ {:id}', { id: filter.petId });
  if ('text' in filter) {
    return client.filter("text ~ {:text} && repostOf = ''", { text: filter.text });
  }
  if ('followedBy' in filter) {
    return client.filter('author.follows_via_following.follower ?= {:id}', {
      id: filter.followedBy,
    });
  }
  // Discover shows each post once: reposts only appear in Following and on profiles.
  return "repostOf = ''";
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
  const items = await withMine(client, result.items.map(toPost));
  return { items, page, hasMore: result.items.length === perPage };
}

export async function getPost(client: PocketBase, id: string): Promise<Post> {
  const [post] = await withMine(client, [
    toPost(await client.collection(POSTS).getOne(id, { expand: POST_EXPAND })),
  ]);
  return post as Post;
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
  return toPost(
    await client.collection(POSTS).create(data, { expand: POST_EXPAND, fetch: uploadFetch }),
  );
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

/** Reposts `postId` with an optional comment. Returns the new repost. */
export async function addRepost(
  client: PocketBase,
  authorId: string,
  postId: string,
  comment: string,
): Promise<Post> {
  return toPost(
    await client
      .collection(POSTS)
      .create(
        { author: authorId, repostOf: postId, text: comment.trim() },
        { expand: POST_EXPAND },
      ),
  );
}

/** Undoes the user's repost of `postId` (looks it up if its id is not known). */
export async function removeRepost(
  client: PocketBase,
  userId: string,
  postId: string,
  repostId: string | null,
): Promise<void> {
  const id =
    repostId ??
    (
      await client
        .collection(POSTS)
        .getFirstListItem(
          client.filter('author = {:user} && repostOf = {:post}', { user: userId, post: postId }),
        )
    ).id;
  await client.collection(POSTS).delete(id);
}
