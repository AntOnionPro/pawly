import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';

import {
  countPendingRequests,
  getMyRequest,
  listAdoptionRequests,
  listSentRequests,
  sendAdoptionRequest,
  setRequestStatus,
  type RequestStatus,
} from './requests';

export const requestKeys = {
  all: ['adoptionRequests'] as const,
  mine: (me: string, adoptionId: string) => ['adoptionRequests', 'mine', me, adoptionId] as const,
  forAdoption: (adoptionId: string) => ['adoptionRequests', 'adoption', adoptionId] as const,
  pending: (adoptionId: string) => ['adoptionRequests', 'pending', adoptionId] as const,
  sent: (me: string) => ['adoptionRequests', 'sent', me] as const,
};

/** The signed-in user's request for a listing (`null` when none; disabled for visitors). */
export function useMyRequest(adoptionId: string | undefined) {
  const { client, user, status } = useAuth();
  const me = user?.id ?? '';
  return useQuery({
    queryKey: requestKeys.mine(me, adoptionId ?? ''),
    queryFn: () => getMyRequest(client, me, adoptionId ?? ''),
    enabled: status === 'signedIn' && Boolean(me && adoptionId),
  });
}

/** Requests for a listing, for its publisher. */
export function useAdoptionRequests(adoptionId: string | undefined) {
  const { client } = useAuth();
  return useQuery({
    queryKey: requestKeys.forAdoption(adoptionId ?? ''),
    queryFn: () => listAdoptionRequests(client, adoptionId ?? ''),
    enabled: Boolean(adoptionId),
  });
}

export function usePendingRequestCount(adoptionId: string | undefined, enabled: boolean) {
  const { client } = useAuth();
  return useQuery({
    queryKey: requestKeys.pending(adoptionId ?? ''),
    queryFn: () => countPendingRequests(client, adoptionId ?? ''),
    enabled: enabled && Boolean(adoptionId),
  });
}

/** "My requests": the requests the signed-in user sent. */
export function useSentRequests() {
  const { client, user, status } = useAuth();
  const me = user?.id ?? '';
  return useQuery({
    queryKey: requestKeys.sent(me),
    queryFn: () => listSentRequests(client, me),
    enabled: status === 'signedIn' && Boolean(me),
  });
}

export function useSendRequest() {
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ adoptionId, message }: { adoptionId: string; message: string }) =>
      sendAdoptionRequest(client, user?.id ?? '', adoptionId, message),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: requestKeys.all }),
  });
}

export function useSetRequestStatus() {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RequestStatus }) =>
      setRequestStatus(client, id, status),
    onSettled: () => queryClient.invalidateQueries({ queryKey: requestKeys.all }),
  });
}
