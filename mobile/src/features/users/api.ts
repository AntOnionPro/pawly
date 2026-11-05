import type PocketBase from 'pocketbase';

import { toUser, USERS, type User } from '@/auth/AuthProvider';

/** Public profile of any user: username, bio and photo (never the email). */
export async function getUser(client: PocketBase, id: string): Promise<User> {
  const user = toUser(await client.collection(USERS).getOne(id));
  if (!user) throw new Error('User not found');
  return user;
}
