import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';

import { createPost, deletePost, getPost, updatePost, type NewPost, type PostChanges } from './api';

export const postKeys = {
  all: ['posts'] as const,
  detail: (id: string) => ['posts', 'detail', id] as const,
};

export function usePost(id: string | undefined) {
  const { client } = useAuth();
  return useQuery({
    queryKey: postKeys.detail(id ?? ''),
    queryFn: () => getPost(client, id ?? ''),
    enabled: Boolean(id),
  });
}

export function useCreatePost() {
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (post: NewPost) => createPost(client, user?.id ?? '', post),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postKeys.all }),
  });
}

export function useUpdatePost() {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: PostChanges }) =>
      updatePost(client, id, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postKeys.all }),
  });
}

export function useDeletePost() {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePost(client, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postKeys.all }),
  });
}
