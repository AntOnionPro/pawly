import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { requestErrorKey, requestErrorKind } from '@/api/errors';
import { WEB_URL } from '@/api/config';
import { useAuth } from '@/auth/AuthProvider';
import { confirm } from '@/utils/confirm';
import { notify } from '@/utils/notify';
import { shareLink } from '@/utils/share';

import { addRepost, removeRepost, type Post } from './api';
import { removeCachedPost, updateCachedPost } from './cache';
import { postKeys } from './hooks';

/** Link to a post in the web version. */
export function postUrl(postId: string): string {
  return `${WEB_URL}/post/${postId}`;
}

function invalidateLists(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: [...postKeys.all, 'list'] });
}

/** Reposts a post with an optional comment, and marks it as reposted everywhere. */
export function useAddRepost() {
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, comment }: { postId: string; comment: string }) =>
      addRepost(client, user?.id ?? '', postId, comment),
    onSuccess: (repost, { postId }) => {
      updateCachedPost(queryClient, postId, (post) => ({
        ...post,
        repostedByMe: true,
        myRepostId: repost.id,
        repostCount: post.repostCount + 1,
      }));
      void invalidateLists(queryClient);
    },
  });
}

/** Undoes the user's repost of `postId`, removing it from every list. */
export function useUndoRepost() {
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, repostId }: { postId: string; repostId: string | null }) =>
      removeRepost(client, user?.id ?? '', postId, repostId),
    onSuccess: (_data, { postId, repostId }) => {
      if (repostId) removeCachedPost(queryClient, repostId);
      updateCachedPost(queryClient, postId, (post) => ({
        ...post,
        repostedByMe: false,
        myRepostId: null,
        repostCount: Math.max(0, post.repostCount - 1),
      }));
      void invalidateLists(queryClient);
    },
  });
}

/** Asks before undoing a repost; explains if it fails. */
export function useUndoRepostAction(): (postId: string, repostId: string | null) => void {
  const { t } = useTranslation();
  const undo = useUndoRepost();
  return (postId, repostId) => {
    void (async () => {
      const confirmed = await confirm({
        title: t('reposts.undoConfirmTitle'),
        message: t('reposts.undoConfirmMessage'),
        confirmLabel: t('reposts.undo'),
        cancelLabel: t('common.cancel'),
        destructive: true,
      });
      if (!confirmed) return;
      undo.mutate(
        { postId, repostId },
        {
          onError: (error) => {
            const key = requestErrorKey(requestErrorKind(error)) ?? 'errors.generic';
            notify(`${t('reposts.undoFailed')} ${t(key)}`);
          },
        },
      );
    })();
  };
}

/**
 * What the repost button does: visitors go to sign in; a reposted post asks to undo it;
 * otherwise it opens the repost screen (to add an optional comment).
 */
export function useRepostAction(): (post: Post) => void {
  const router = useRouter();
  const { status } = useAuth();
  const undo = useUndoRepostAction();
  return (post) => {
    if (status !== 'signedIn') {
      router.push('/sign-in');
      return;
    }
    if (post.repostedByMe) {
      undo(post.id, post.myRepostId);
      return;
    }
    router.push({ pathname: '/post/[id]/repost', params: { id: post.id } });
  };
}

/** Opens the system share sheet with the link to a post in the web version. */
export function useShareOutside(): (post: Post) => void {
  const { t } = useTranslation();
  return (post) => {
    shareLink({ message: t('share.message'), url: postUrl(post.id) })
      .then((result) => {
        if (result === 'copied') notify(t('share.copied'));
      })
      .catch(() => notify(t('share.failed')));
  };
}

/**
 * What the share button does: users choose between sending it by message or sharing it
 * outside Pawly; visitors (who have no messages) share it outside directly.
 */
export function useShareAction(): (post: Post) => void {
  const router = useRouter();
  const { status } = useAuth();
  const shareOutside = useShareOutside();
  return (post) => {
    if (status !== 'signedIn') {
      shareOutside(post);
      return;
    }
    router.push({ pathname: '/post/[id]/send', params: { id: post.id } });
  };
}
