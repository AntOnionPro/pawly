import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';

import { getUser } from './api';

export function useUser(id: string | undefined) {
  const { client } = useAuth();
  return useQuery({
    queryKey: ['users', id ?? ''],
    queryFn: () => getUser(client, id ?? ''),
    enabled: Boolean(id),
  });
}
