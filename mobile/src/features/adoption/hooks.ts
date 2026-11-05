import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';
import { petKeys } from '@/features/pets/hooks';
import { postKeys } from '@/features/posts/hooks';

import {
  completeAdoption,
  createAdoption,
  deleteAdoption,
  getAdoptedListing,
  getAdoption,
  getPetAdoption,
  listAdoptions,
  updateAdoption,
  type Adoption,
  type AdoptionFilter,
  type AdoptionValues,
} from './api';

export const adoptionKeys = {
  all: ['adoptions'] as const,
  list: (filter: AdoptionFilter) => ['adoptions', 'list', filter] as const,
  detail: (id: string) => ['adoptions', 'detail', id] as const,
  byPet: (petId: string) => ['adoptions', 'pet', petId] as const,
  adoptedPet: (petId: string) => ['adoptions', 'adopted', petId] as const,
};

/** Pages of available listings, newest first. */
export function useAdoptionList(filter: AdoptionFilter) {
  const { client } = useAuth();
  return useInfiniteQuery({
    queryKey: adoptionKeys.list(filter),
    queryFn: ({ pageParam }) => listAdoptions(client, filter, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

export function useAdoption(id: string | undefined) {
  const { client } = useAuth();
  return useQuery({
    queryKey: adoptionKeys.detail(id ?? ''),
    queryFn: () => getAdoption(client, id ?? ''),
    enabled: Boolean(id),
  });
}

/** The available listing of a pet (`null` when it has none). */
export function usePetAdoption(petId: string | undefined) {
  const { client } = useAuth();
  return useQuery({
    queryKey: adoptionKeys.byPet(petId ?? ''),
    queryFn: () => getPetAdoption(client, petId ?? ''),
    enabled: Boolean(petId),
  });
}

/** Creates a listing, or updates it when `id` is given, and refreshes every listing. */
export function useSaveAdoption() {
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: AdoptionValues }): Promise<Adoption> =>
      id ? updateAdoption(client, id, values) : createAdoption(client, user?.id ?? '', values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adoptionKeys.all }),
  });
}

export function useDeleteAdoption() {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdoption(client, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adoptionKeys.all }),
  });
}

/** The listing through which a pet was last adopted (`null` if none). */
export function useAdoptedListing(petId: string | undefined, enabled: boolean) {
  const { client } = useAuth();
  return useQuery({
    queryKey: adoptionKeys.adoptedPet(petId ?? ''),
    queryFn: () => getAdoptedListing(client, petId ?? ''),
    enabled: enabled && Boolean(petId),
  });
}

/** Marks a listing as adopted; the pet changes owner, so pets, posts and requests refresh. */
export function useCompleteAdoption() {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ adoptionId, requestId }: { adoptionId: string; requestId: string }) =>
      completeAdoption(client, adoptionId, requestId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adoptionKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['adoptionRequests'] }),
        queryClient.invalidateQueries({ queryKey: petKeys.all }),
        queryClient.invalidateQueries({ queryKey: postKeys.all }),
      ]);
    },
  });
}
