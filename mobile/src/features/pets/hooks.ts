import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';

import { createPet, deletePet, getPet, listPets, updatePet, type Pet, type PetValues } from './api';

export const petKeys = {
  all: ['pets'] as const,
  byOwner: (ownerId: string) => ['pets', 'owner', ownerId] as const,
  detail: (id: string) => ['pets', 'detail', id] as const,
};

export function usePets(ownerId: string | undefined) {
  const { client } = useAuth();
  return useQuery({
    queryKey: petKeys.byOwner(ownerId ?? ''),
    queryFn: () => listPets(client, ownerId ?? ''),
    enabled: Boolean(ownerId),
  });
}

export function usePet(id: string | undefined) {
  const { client } = useAuth();
  return useQuery({
    queryKey: petKeys.detail(id ?? ''),
    queryFn: () => getPet(client, id ?? ''),
    enabled: Boolean(id),
  });
}

/** Creates or updates a pet (`id` given) and refreshes every pet list. */
export function useSavePet() {
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: PetValues }): Promise<Pet> =>
      id ? updatePet(client, id, values) : createPet(client, user?.id ?? '', values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: petKeys.all }),
  });
}

export function useDeletePet() {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePet(client, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: petKeys.all }),
  });
}
