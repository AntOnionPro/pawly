import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { requestErrorKey, requestErrorKind } from '@/api/errors';
import { useAuth, type User } from '@/auth/AuthProvider';
import { followKeys } from '@/features/follows/hooks';
import type { Post } from '@/features/posts/api';
import { postKeys } from '@/features/posts/hooks';
import { userKeys } from '@/features/users/hooks';
import { confirm } from '@/utils/confirm';
import { notify } from '@/utils/notify';

import {
  blockUser,
  listBlocks,
  sendReport,
  unblockUser,
  type ReportReason,
  type ReportTarget,
} from './api';

export const blockKeys = {
  list: (blockerId: string) => ['blocks', blockerId] as const,
};

/** The users the signed-in user blocked (none for visitors). */
export function useBlocks() {
  const { client, user, status } = useAuth();
  const me = user?.id ?? '';
  return useQuery({
    queryKey: blockKeys.list(me),
    queryFn: () => listBlocks(client, me),
    enabled: status === 'signedIn' && Boolean(me),
  });
}

/** Ids of the blocked users, to hide their content. */
export function useBlockedIds(): Set<string> {
  const { data } = useBlocks();
  return new Set((data ?? []).map((block) => block.blockedId));
}

/** Whether a post (or the original inside a repost) is by a blocked user. */
export function isHiddenPost(post: Post, blocked: Set<string>): boolean {
  return (
    blocked.has(post.authorId) || (post.repostOf ? blocked.has(post.repostOf.authorId) : false)
  );
}

/** Blocking changes follows, counts and feeds: refresh them from the server. */
function refreshAfterBlockChange(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['blocks'] });
  void queryClient.invalidateQueries({ queryKey: followKeys.all });
  void queryClient.invalidateQueries({ queryKey: userKeys.all });
  void queryClient.invalidateQueries({ queryKey: [...postKeys.all, 'list'] });
}

export function useBlockUser() {
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => blockUser(client, user?.id ?? '', userId),
    onSuccess: () => refreshAfterBlockChange(queryClient),
  });
}

export function useUnblockUser() {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blockId: string) => unblockUser(client, blockId),
    onSuccess: () => refreshAfterBlockChange(queryClient),
  });
}

/**
 * Block and unblock `target` from their profile. Visitors go to sign in; blocking asks first;
 * errors are explained.
 */
export function useBlockAction(target: User) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useAuth();
  const { data: blocks } = useBlocks();
  const blockMutation = useBlockUser();
  const unblockMutation = useUnblockUser();
  const current = blocks?.find((block) => block.blockedId === target.id);

  const onError = (error: unknown) => {
    const key = requestErrorKey(requestErrorKind(error)) ?? 'errors.generic';
    notify(`${t('blocks.failed')} ${t(key)}`);
  };

  return {
    blocked: current !== undefined,
    busy: blockMutation.isPending || unblockMutation.isPending,
    block: async () => {
      if (status !== 'signedIn') {
        router.push('/sign-in');
        return;
      }
      const confirmed = await confirm({
        title: t('blocks.confirmTitle', { username: target.username }),
        message: t('blocks.confirmMessage'),
        confirmLabel: t('blocks.block'),
        cancelLabel: t('common.cancel'),
        destructive: true,
      });
      if (confirmed) blockMutation.mutate(target.id, { onError });
    },
    unblock: () => {
      if (current) unblockMutation.mutate(current.id, { onError });
    },
  };
}

export function useSendReport() {
  const { client, user } = useAuth();
  return useMutation({
    mutationFn: ({
      target,
      reason,
      details,
    }: {
      target: ReportTarget;
      reason: ReportReason;
      details: string;
    }) => sendReport(client, user?.id ?? '', target, reason, details),
  });
}

/** What a "Report" button does: visitors go to sign in; users open the report screen. */
export function useReportAction(): (target: ReportTarget) => void {
  const router = useRouter();
  const { status } = useAuth();
  return (target) => {
    if (status !== 'signedIn') {
      router.push('/sign-in');
      return;
    }
    router.push({ pathname: '/report', params: { kind: target.kind, id: target.id } });
  };
}
