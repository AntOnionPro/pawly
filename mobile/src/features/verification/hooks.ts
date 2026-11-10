import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';

import {
  cancelVerification,
  getLatestVerification,
  sendVerification,
  type VerificationValues,
} from './api';

export const verificationKeys = {
  latest: (userId: string) => ['verification', 'latest', userId] as const,
};

/** The signed-in user's newest verification request (`null` when they never asked). */
export function useLatestVerification() {
  const { client, user } = useAuth();
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: verificationKeys.latest(userId),
    queryFn: () => getLatestVerification(client, userId),
    enabled: Boolean(userId),
  });
}

export function useSendVerification() {
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';
  return useMutation({
    mutationFn: (values: VerificationValues) => sendVerification(client, userId, values),
    onSuccess: (request) => queryClient.setQueryData(verificationKeys.latest(userId), request),
  });
}

export function useCancelVerification() {
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';
  return useMutation({
    mutationFn: (id: string) => cancelVerification(client, id),
    // An earlier request (a rejected one, for example) may be the newest one now.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: verificationKeys.latest(userId) }),
  });
}
