import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { requestErrorKey, requestErrorKind } from '@/api/errors';
import { useAuth, type User } from '@/auth/AuthProvider';
import { postKeys } from '@/features/posts/hooks';
import { userKeys } from '@/features/users/hooks';
import { notify } from '@/utils/notify';

import { findFollow, follow, listFollows, unfollow, type FollowList } from './api';

export const followKeys = {
  all: ['follows'] as const,
  status: (followerId: string, followingId: string) =>
    ['follows', 'status', followerId, followingId] as const,
  list: (userId: string, list: FollowList) => ['follows', list, userId] as const,
};

/**
 * Whether the signed-in user follows `targetId`: the id of the follow, '' while a new follow
 * is being saved, or null if they do not follow them.
 */
export function useFollowStatus(targetId: string) {
  const { client, user, status } = useAuth();
  const me = user?.id ?? '';
  return useQuery({
    queryKey: followKeys.status(me, targetId),
    queryFn: () => findFollow(client, me, targetId),
    enabled: status === 'signedIn' && Boolean(me) && Boolean(targetId) && targetId !== me,
  });
}

/** Pages of the followers of a user, or of the users they follow. */
export function useFollowList(userId: string, list: FollowList) {
  const { client } = useAuth();
  return useInfiniteQuery({
    queryKey: followKeys.list(userId, list),
    queryFn: ({ pageParam }) => listFollows(client, userId, list, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: Boolean(userId),
  });
}

/** Follows or unfollows `targetId`, updating the button and both counts at once (optimistic). */
export function useToggleFollow(targetId: string) {
  const { client, user } = useAuth();
  const me = user?.id ?? '';
  const queryClient = useQueryClient();
  const statusKey = followKeys.status(me, targetId);

  function changeCounts(delta: number) {
    queryClient.setQueryData<User>(userKeys.detail(targetId), (target) =>
      target ? { ...target, followerCount: Math.max(0, target.followerCount + delta) } : target,
    );
    queryClient.setQueryData<User>(userKeys.detail(me), (mine) =>
      mine ? { ...mine, followingCount: Math.max(0, mine.followingCount + delta) } : mine,
    );
  }

  return useMutation({
    mutationFn: async (followId: string | null): Promise<string | null> => {
      if (followId) {
        await unfollow(client, followId);
        return null;
      }
      return follow(client, me, targetId);
    },
    onMutate: async (followId) => {
      await queryClient.cancelQueries({ queryKey: statusKey });
      await queryClient.cancelQueries({ queryKey: userKeys.all });
      const previous = {
        status: queryClient.getQueryData<string | null>(statusKey),
        target: queryClient.getQueryData<User>(userKeys.detail(targetId)),
        mine: queryClient.getQueryData<User>(userKeys.detail(me)),
      };
      queryClient.setQueryData(statusKey, followId ? null : '');
      changeCounts(followId ? -1 : 1);
      return previous;
    },
    onError: (_error, _followId, previous) => {
      if (!previous) return;
      queryClient.setQueryData(statusKey, previous.status);
      queryClient.setQueryData(userKeys.detail(targetId), previous.target);
      queryClient.setQueryData(userKeys.detail(me), previous.mine);
    },
    onSuccess: (followId) => {
      queryClient.setQueryData(statusKey, followId);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: followKeys.list(targetId, 'followers') });
      void queryClient.invalidateQueries({ queryKey: followKeys.list(me, 'following') });
      void queryClient.invalidateQueries({ queryKey: postKeys.list({ followedBy: me }) });
    },
  });
}

/**
 * What a follow button does: visitors go to sign in; signed-in users follow or unfollow.
 * Taps while saving are ignored.
 */
export function useFollowAction(targetId: string) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useAuth();
  const followStatus = useFollowStatus(targetId);
  const toggle = useToggleFollow(targetId);
  const followId = followStatus.data;

  return {
    following: typeof followId === 'string',
    loading: status === 'signedIn' && followStatus.isPending,
    toggle: () => {
      if (status !== 'signedIn') {
        router.push('/sign-in');
        return;
      }
      if (toggle.isPending || followId === undefined) return;
      toggle.mutate(followId || null, {
        onError: (error) => {
          const key = requestErrorKey(requestErrorKind(error)) ?? 'errors.generic';
          notify(`${t('follows.failed')} ${t(key)}`);
        },
      });
    },
  };
}
