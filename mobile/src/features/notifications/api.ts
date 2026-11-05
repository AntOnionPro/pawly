import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import { toUser, type User } from '@/auth/AuthProvider';
import { toPost, type Post } from '@/features/posts/api';

export const NOTIFICATIONS = 'notifications';
export const NOTIFICATIONS_PER_PAGE = 30;

export type NotificationType = 'paw' | 'comment' | 'follow' | 'repost';

/** Named so it does not clash with the browser's `Notification`. */
export interface AppNotification {
  id: string;
  type: NotificationType;
  actorId: string;
  actor?: User;
  postId: string;
  post?: Post;
  /** Text of the comment, for comment notifications. */
  commentText: string;
  read: boolean;
  created: string;
}

export interface NotificationPage {
  items: AppNotification[];
  page: number;
  hasMore: boolean;
}

const TYPES: readonly NotificationType[] = ['paw', 'comment', 'follow', 'repost'];

export function toNotification(record: RecordModel): AppNotification {
  const expand = (record.expand ?? {}) as {
    actor?: RecordModel;
    post?: RecordModel;
    comment?: RecordModel;
  };
  const type = TYPES.find((value) => value === record.type) ?? 'paw';
  return {
    id: record.id,
    type,
    actorId: String(record.actor ?? ''),
    actor: toUser(expand.actor) ?? undefined,
    postId: String(record.post ?? ''),
    post: expand.post ? toPost(expand.post) : undefined,
    commentText: String(expand.comment?.text ?? ''),
    read: Boolean(record.read),
    created: String(record.created ?? ''),
  };
}

/** One page of the user's notifications, newest first. */
export async function listNotifications(
  client: PocketBase,
  me: string,
  page: number,
  perPage: number = NOTIFICATIONS_PER_PAGE,
): Promise<NotificationPage> {
  const result = await client.collection(NOTIFICATIONS).getList(page, perPage, {
    filter: client.filter('recipient = {:me}', { me }),
    sort: '-created,-id',
    expand: 'actor,post,comment',
    skipTotal: true,
  });
  return {
    items: result.items.map(toNotification),
    page,
    hasMore: result.items.length === perPage,
  };
}

export async function countUnreadNotifications(client: PocketBase, me: string): Promise<number> {
  const result = await client.collection(NOTIFICATIONS).getList(1, 1, {
    filter: client.filter('recipient = {:me} && read = false', { me }),
    fields: 'id',
  });
  return result.totalItems;
}

/** Marks all of the signed-in user's notifications as read. */
export async function markAllNotificationsRead(client: PocketBase): Promise<void> {
  await client.send('/api/pawly/notifications/read', { method: 'POST' });
}
