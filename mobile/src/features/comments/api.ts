import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import { toUser, type User } from '@/auth/AuthProvider';
import { parseServerDate } from '@/utils/time';

export const COMMENTS = 'comments';
/** Same limit as the server (server/pb_migrations/…_comments.js). */
export const COMMENT_TEXT_MAX = 500;
export const COMMENTS_PER_PAGE = 30;

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  /** Present when the author was expanded. */
  author?: User;
  text: string;
  created: string;
  /** Whether the text changed after it was written. */
  edited: boolean;
}

/** Where a page of comments ends: the next page starts after this comment. */
export interface CommentCursor {
  created: string;
  id: string;
}

export interface CommentPage {
  items: Comment[];
  /** Cursor for the next page, or null if this is the last one. */
  next: CommentCursor | null;
}

/** Edits a second or more after writing count as edited (both dates are set on create). */
const EDITED_AFTER_MS = 1000;

export function toComment(record: RecordModel): Comment {
  const expand = (record.expand ?? {}) as { author?: RecordModel };
  const created = String(record.created ?? '');
  const createdAt = parseServerDate(created);
  const updatedAt = parseServerDate(String(record.updated ?? ''));
  return {
    id: record.id,
    postId: String(record.post ?? ''),
    authorId: String(record.author ?? ''),
    author: toUser(expand.author) ?? undefined,
    text: String(record.text ?? ''),
    created,
    edited: Boolean(
      createdAt && updatedAt && updatedAt.getTime() - createdAt.getTime() >= EDITED_AFTER_MS,
    ),
  };
}

/**
 * One page of the comments of a post, oldest first. Pages continue after the last comment
 * seen (not by page number), so new or deleted comments do not shift the next page.
 */
export async function listComments(
  client: PocketBase,
  postId: string,
  after: CommentCursor | null,
  perPage: number = COMMENTS_PER_PAGE,
): Promise<CommentPage> {
  const filters = [client.filter('post = {:post}', { post: postId })];
  if (after) {
    filters.push(
      client.filter('(created > {:created} || (created = {:created} && id > {:id}))', {
        created: after.created,
        id: after.id,
      }),
    );
  }
  const result = await client.collection(COMMENTS).getList(1, perPage, {
    filter: filters.join(' && '),
    sort: 'created,id',
    expand: 'author',
    skipTotal: true,
  });
  const items = result.items.map(toComment);
  const last = items[items.length - 1];
  return {
    items,
    next: items.length === perPage && last ? { created: last.created, id: last.id } : null,
  };
}

export async function addComment(
  client: PocketBase,
  authorId: string,
  postId: string,
  text: string,
): Promise<Comment> {
  return toComment(
    await client
      .collection(COMMENTS)
      .create({ author: authorId, post: postId, text: text.trim() }, { expand: 'author' }),
  );
}

export async function updateComment(
  client: PocketBase,
  id: string,
  text: string,
): Promise<Comment> {
  return toComment(
    await client.collection(COMMENTS).update(id, { text: text.trim() }, { expand: 'author' }),
  );
}

export async function deleteComment(client: PocketBase, id: string): Promise<void> {
  await client.collection(COMMENTS).delete(id);
}

/** Every loaded comment in order. A comment in two pages keeps its later place. */
export function flattenComments(pages: CommentPage[]): Comment[] {
  const byId = new Map<string, Comment>();
  for (const page of pages) {
    for (const comment of page.items) {
      byId.delete(comment.id);
      byId.set(comment.id, comment);
    }
  }
  return [...byId.values()];
}
