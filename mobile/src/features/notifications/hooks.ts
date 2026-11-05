import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRealtime } from '@/api/useRealtime';
import { useAuth } from '@/auth/AuthProvider';

import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  NOTIFICATIONS,
} from './api';

export const notificationKeys = {
  all: (me: string) => ['notifications', me] as const,
  list: (me: string) => ['notifications', me, 'list'] as const,
  unread: (me: string) => ['notifications', me, 'unread'] as const,
};

/** Pages of the user's notifications, newest first. Updates live. */
export function useNotifications() {
  const { client, user, status } = useAuth();
  const me = user?.id ?? '';
  const queryClient = useQueryClient();
  const enabled = status === 'signedIn' && Boolean(me);
  useRealtime(NOTIFICATIONS, { filter: '' }, enabled, () => {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.list(me) });
  });
  return useInfiniteQuery({
    queryKey: notificationKeys.list(me),
    queryFn: ({ pageParam }) => listNotifications(client, me, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
  });
}

/** How many notifications are unread (for the bell). Updates live. */
export function useUnreadNotifications() {
  const { client, user, status } = useAuth();
  const me = user?.id ?? '';
  const queryClient = useQueryClient();
  const enabled = status === 'signedIn' && Boolean(me);
  useRealtime(NOTIFICATIONS, { filter: '' }, enabled, () => {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.unread(me) });
  });
  return useQuery({
    queryKey: notificationKeys.unread(me),
    queryFn: () => countUnreadNotifications(client, me),
    enabled,
  });
}

/** Marks every notification as read; the open list keeps showing which ones were new. */
export function useMarkAllNotificationsRead() {
  const { client, user } = useAuth();
  const me = user?.id ?? '';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(client),
    onSuccess: () => {
      queryClient.setQueryData(notificationKeys.unread(me), 0);
    },
  });
}
