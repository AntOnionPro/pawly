import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import { toUser, type User } from '@/auth/AuthProvider';

export const FOLLOWS = 'follows';
export const FOLLOWS_PER_PAGE = 30;

/** The followers of a user, or the users they follow. */
export type FollowList = 'followers' | 'following';

export interface UserPage {
  items: User[];
  page: number;
  hasMore: boolean;
}

/** Id of the follow from `followerId` to `followingId`, or null if they do not follow. */
export async function findFollow(
  client: PocketBase,
  followerId: string,
  followingId: string,
): Promise<string | null> {
  const result = await client.collection(FOLLOWS).getList(1, 1, {
    filter: client.filter('follower = {:follower} && following = {:following}', {
      follower: followerId,
      following: followingId,
    }),
    fields: 'id',
    skipTotal: true,
  });
  return result.items[0]?.id ?? null;
}

/** Follows a user. Returns the id of the follow. */
export async function follow(
  client: PocketBase,
  followerId: string,
  followingId: string,
): Promise<string> {
  const record = await client
    .collection(FOLLOWS)
    .create({ follower: followerId, following: followingId });
  return record.id;
}

export async function unfollow(client: PocketBase, followId: string): Promise<void> {
  await client.collection(FOLLOWS).delete(followId);
}

/** One page of followers or followed users, most recent first. */
export async function listFollows(
  client: PocketBase,
  userId: string,
  list: FollowList,
  page: number,
  perPage: number = FOLLOWS_PER_PAGE,
): Promise<UserPage> {
  // Followers: follows that point to the user; following: follows the user made.
  const [field, other] =
    list === 'followers'
      ? (['following', 'follower'] as const)
      : (['follower', 'following'] as const);
  const result = await client.collection(FOLLOWS).getList(page, perPage, {
    filter: client.filter(`${field} = {:id}`, { id: userId }),
    sort: '-created,-id',
    expand: other,
    skipTotal: true,
  });
  const items = result.items
    .map((record) => toUser((record.expand as Record<string, RecordModel> | undefined)?.[other]))
    .filter((user): user is User => user !== null);
  return { items, page, hasMore: result.items.length === perPage };
}
