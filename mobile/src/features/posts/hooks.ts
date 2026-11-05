import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';

import {
  createPost,
  deletePost,
  getPost,
  listPosts,
  updatePost,
  type NewPost,
  type PostChanges,
  type PostFilter,
} from './api';

export const postKeys = {
  all: ['posts'] as const,
  detail: (id: string) => ['posts', 'detail', id] as const,
  list: (filter: PostFilter) => ['posts', 'list', filter] as const,
};

/** Pages of posts (feed, a user or a pet), newest first. */
export function usePostList(filter: PostFilter, enabled = true) {
  const { client } = useAuth();
  return useInfiniteQuery({
    queryKey: postKeys.list(filter),
    queryFn: ({ pageParam }) => listPosts(client, filter, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
  });
}

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
