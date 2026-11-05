import type PocketBase from 'pocketbase';

import { toUser, USERS, type User } from '@/auth/AuthProvider';
import { PETS, toPet, type Pet } from '@/features/pets/api';

export const SEARCH_PER_PAGE = 20;

export interface SearchPage<T> {
  items: T[];
  page: number;
  hasMore: boolean;
}

/**
 * What to search for: trimmed, and without "%" (PocketBase would take it as a wildcard and
 * stop matching the text anywhere).
 */
export function cleanQuery(query: string): string {
  return query.replace(/%/g, '').trim();
}

/** Users whose username contains the text (needs a session: visitors cannot list users). */
export async function searchUsers(
  client: PocketBase,
  query: string,
  page: number,
  perPage: number = SEARCH_PER_PAGE,
): Promise<SearchPage<User>> {
  const result = await client.collection(USERS).getList(page, perPage, {
    filter: client.filter('username ~ {:query}', { query }),
    sort: 'username',
    skipTotal: true,
  });
  const items = result.items.map(toUser).filter((user): user is User => user !== null);
  return { items, page, hasMore: result.items.length === perPage };
}

/** Pets whose name or breed contains the text, with their owner's username. */
export async function searchPets(
  client: PocketBase,
  query: string,
  page: number,
  perPage: number = SEARCH_PER_PAGE,
): Promise<SearchPage<Pet>> {
  const result = await client.collection(PETS).getList(page, perPage, {
    filter: client.filter('name ~ {:query} || breed ~ {:query}', { query }),
    sort: 'name,id',
    expand: 'owner',
    skipTotal: true,
  });
  return { items: result.items.map(toPet), page, hasMore: result.items.length === perPage };
}
