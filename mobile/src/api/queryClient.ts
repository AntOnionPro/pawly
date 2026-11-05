import { QueryClient } from '@tanstack/react-query';

/** Shared cache for server data (pets, posts…). */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is fresh for 30 s; pull to refresh or a mutation updates it sooner.
        staleTime: 30_000,
        retry: 1,
      },
    },
  });
}
