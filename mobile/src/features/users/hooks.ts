import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';

import { getUser } from './api';

export const userKeys = {
  all: ['users'] as const,
  detail: (id: string) => ['users', id] as const,
};

export function useUser(id: string | undefined) {
  const { client } = useAuth();
  return useQuery({
    queryKey: userKeys.detail(id ?? ''),
    queryFn: () => getUser(client, id ?? ''),
    enabled: Boolean(id),
  });
}
