import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import { requestErrorKey, requestErrorKind, toFieldErrors, type ErrorKey } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { updateCachedPost } from '@/features/posts/cache';

import {
  addComment,
  deleteComment,
  listComments,
  updateComment,
  type CommentCursor,
  type CommentPage,
} from './api';

export const commentKeys = {
  all: ['comments'] as const,
  list: (postId: string) => ['comments', postId] as const,
};

type CommentData = InfiniteData<CommentPage, CommentCursor | null>;

/** Pages of the comments of a post, oldest first. */
export function useComments(postId: string, enabled = true) {
  const { client } = useAuth();
  return useInfiniteQuery({
    queryKey: commentKeys.list(postId),
    queryFn: ({ pageParam }) => listComments(client, postId, pageParam),
    initialPageParam: null as CommentCursor | null,
    getNextPageParam: (last) => last.next ?? undefined,
    enabled,
  });
}

/** Changes the loaded comments of a post without refetching them. */
function updateCachedComments(
  queryClient: QueryClient,
  postId: string,
  change: (pages: CommentPage[]) => CommentPage[],
): void {
  queryClient.setQueryData<CommentData>(commentKeys.list(postId), (data) =>
    data ? { ...data, pages: change(data.pages) } : data,
  );
}

function changeCommentCount(queryClient: QueryClient, postId: string, delta: number): void {
  updateCachedPost(queryClient, postId, (post) => ({
    ...post,
    commentCount: Math.max(0, post.commentCount + delta),
  }));
}

/** Adds a comment at the end of the loaded ones and counts it on every screen. */
export function useAddComment(postId: string) {
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => addComment(client, user?.id ?? '', postId, text),
    onSuccess: (comment) => {
      updateCachedComments(queryClient, postId, (pages) =>
        pages.map((page, index) =>
          index === pages.length - 1 ? { ...page, items: [...page.items, comment] } : page,
        ),
      );
      changeCommentCount(queryClient, postId, 1);
    },
  });
}

export function useUpdateComment(postId: string) {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => updateComment(client, id, text),
    onSuccess: (comment) => {
      updateCachedComments(queryClient, postId, (pages) =>
        pages.map((page) => ({
          ...page,
          items: page.items.map((item) => (item.id === comment.id ? comment : item)),
        })),
      );
    },
  });
}

export function useDeleteComment(postId: string) {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteComment(client, id),
    onSuccess: (_data, id) => {
      updateCachedComments(queryClient, postId, (pages) =>
        pages.map((page) => ({ ...page, items: page.items.filter((item) => item.id !== id) })),
      );
      changeCommentCount(queryClient, postId, -1);
    },
  });
}

/** Message for a failed comment request: the field error (text, block…), or why it failed. */
export function commentErrorKey(error: unknown): ErrorKey {
  const fields = toFieldErrors(error);
  const fieldError = fields.text ?? Object.values(fields)[0];
  if (fieldError) return fieldError;
  const kind = requestErrorKind(error);
  const key = kind === 'network' || kind === 'rateLimited' ? requestErrorKey(kind) : null;
  return key ?? 'errors.generic';
}
