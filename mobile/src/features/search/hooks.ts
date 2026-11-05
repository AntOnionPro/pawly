import { useInfiniteQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';

import { searchPets, searchUsers } from './api';

export const searchKeys = {
  users: (query: string) => ['search', 'users', query] as const,
  pets: (query: string) => ['search', 'pets', query] as const,
};

/** Pages of users matching `query`. Only runs with a query and a session. */
export function useUserSearch(query: string) {
  const { client, status } = useAuth();
  return useInfiniteQuery({
    queryKey: searchKeys.users(query),
    queryFn: ({ pageParam }) => searchUsers(client, query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: query.length > 0 && status === 'signedIn',
  });
}

/** Pages of pets matching `query`. Only runs with a query. */
export function usePetSearch(query: string) {
  const { client } = useAuth();
  return useInfiniteQuery({
    queryKey: searchKeys.pets(query),
    queryFn: ({ pageParam }) => searchPets(client, query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: query.length > 0,
  });
}
