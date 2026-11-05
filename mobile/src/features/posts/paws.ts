import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { requestErrorKey, requestErrorKind } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { notify } from '@/utils/notify';

import { addPaw, removePaw, type Post } from './api';
import { updateCachedPost } from './cache';
import { postKeys } from './hooks';

function toggled(post: Post): Post {
  return {
    ...post,
    pawedByMe: !post.pawedByMe,
    pawCount: Math.max(0, post.pawCount + (post.pawedByMe ? -1 : 1)),
    myPawId: post.pawedByMe ? null : post.myPawId,
  };
}

/** Adds or removes the user's paw print, updating every screen at once (optimistic). */
export function useTogglePaw() {
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (post: Post): Promise<string | null> => {
      const userId = user?.id ?? '';
      if (post.pawedByMe) {
        await removePaw(client, userId, post.id, post.myPawId);
        return null;
      }
      return addPaw(client, userId, post.id);
    },
    onMutate: async (post) => {
      await queryClient.cancelQueries({ queryKey: postKeys.all });
      const previous = queryClient.getQueriesData({ queryKey: postKeys.all });
      updateCachedPost(queryClient, post.id, toggled);
      return { previous };
    },
    onError: (_error, _post, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSuccess: (pawId, post) => {
      if (pawId) {
        updateCachedPost(queryClient, post.id, (current) => ({ ...current, myPawId: pawId }));
      }
    },
  });
}

/**
 * What a paw print button does: visitors go to sign in; signed-in users toggle it.
 * Taps while the same post is saving are ignored.
 */
export function usePawAction(): (post: Post) => void {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useAuth();
  const toggle = useTogglePaw();

  return (post: Post) => {
    if (status !== 'signedIn') {
      router.push('/sign-in');
      return;
    }
    if (toggle.isPending && toggle.variables?.id === post.id) return;
    toggle.mutate(post, {
      onError: (error) => {
        const key = requestErrorKey(requestErrorKind(error)) ?? 'errors.generic';
        notify(`${t('posts.paw.failed')} ${t(key)}`);
      },
    });
  };
}
