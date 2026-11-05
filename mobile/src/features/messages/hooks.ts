import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { RecordSubscription } from 'pocketbase';
import { useEffect, useEffectEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { requestErrorKey, requestErrorKind, toFieldErrors } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { notify } from '@/utils/notify';

import {
  CONVERSATIONS,
  countUnread,
  getConversation,
  listConversations,
  listMessages,
  markRead,
  MESSAGE_EXPAND,
  MESSAGES,
  openConversation,
  sendMessage,
  toMessage,
  type Message,
  type MessageCursor,
  type MessagePage,
} from './api';

export const messageKeys = {
  /** Everything about the user's conversations (list and unread count). */
  conversations: (me: string) => ['conversations', me] as const,
  list: (me: string) => ['conversations', me, 'list'] as const,
  unread: (me: string) => ['conversations', me, 'unread'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (id: string) => ['messages', id] as const,
};

type MessageData = InfiniteData<MessagePage, MessageCursor | null>;

/**
 * Listens to live changes of a collection (PocketBase realtime) while `enabled`. If realtime is
 * not available the screen still works; it just does not update on its own.
 */
function useRealtime(
  collection: string,
  options: { filter: string; expand?: string },
  enabled: boolean,
  onEvent: (event: RecordSubscription) => void,
) {
  const { filter, expand } = options;
  const { client } = useAuth();
  const handle = useEffectEvent(onEvent);
  useEffect(() => {
    if (!enabled) return undefined;
    let unsubscribe: (() => Promise<void>) | null = null;
    let active = true;
    try {
      client
        .collection(collection)
        .subscribe('*', (event) => handle(event), { filter, expand })
        .then((stop) => {
          if (active) unsubscribe = stop;
          else void stop();
        })
        .catch(() => undefined);
    } catch {
      // No realtime connection (for example in tests).
    }
    return () => {
      active = false;
      void unsubscribe?.().catch(() => undefined);
    };
  }, [client, collection, filter, expand, enabled]);
}

/** Pages of the user's conversations, the most recent first. Updates live. */
export function useConversations() {
  const { client, user, status } = useAuth();
  const me = user?.id ?? '';
  const queryClient = useQueryClient();
  const enabled = status === 'signedIn' && Boolean(me);
  useRealtime(CONVERSATIONS, { filter: '' }, enabled, () => {
    void queryClient.invalidateQueries({ queryKey: messageKeys.conversations(me) });
  });
  return useInfiniteQuery({
    queryKey: messageKeys.list(me),
    queryFn: ({ pageParam }) => listConversations(client, me, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
  });
}

/** How many conversations have unread messages (for the badge). Updates live. */
export function useUnreadConversations() {
  const { client, user, status } = useAuth();
  const me = user?.id ?? '';
  const queryClient = useQueryClient();
  const enabled = status === 'signedIn' && Boolean(me);
  useRealtime(CONVERSATIONS, { filter: '' }, enabled, () => {
    void queryClient.invalidateQueries({ queryKey: messageKeys.unread(me) });
  });
  return useQuery({
    queryKey: messageKeys.unread(me),
    queryFn: () => countUnread(client, me),
    enabled,
  });
}

export function useConversation(id: string) {
  const { client, user } = useAuth();
  const me = user?.id ?? '';
  return useQuery({
    queryKey: messageKeys.conversation(id),
    queryFn: () => getConversation(client, id, me),
    enabled: Boolean(id && me),
  });
}

/**
 * Adds a message to the newest page, once (live events and own sends can repeat it). Returns
 * whether it was new.
 */
function addToCache(queryClient: ReturnType<typeof useQueryClient>, message: Message): boolean {
  let added = false;
  queryClient.setQueryData<MessageData>(messageKeys.messages(message.conversationId), (data) => {
    if (!data) return data;
    if (data.pages.some((page) => page.items.some((item) => item.id === message.id))) {
      return data;
    }
    const [first, ...rest] = data.pages;
    if (!first) return data;
    added = true;
    return { ...data, pages: [{ ...first, items: [message, ...first.items] }, ...rest] };
  });
  return added;
}

/**
 * Pages of messages, newest first, and the ones that arrive live. Marks the conversation as
 * read when it opens and when a message arrives.
 */
export function useMessages(conversationId: string) {
  const { client, user } = useAuth();
  const me = user?.id ?? '';
  const queryClient = useQueryClient();
  const read = useMutation({
    mutationFn: () => markRead(client, conversationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messageKeys.conversations(me) }),
  });
  const readNow = useEffectEvent(() => {
    read.mutate();
  });

  useEffect(() => {
    if (conversationId && me) readNow();
  }, [conversationId, me]);

  useRealtime(
    MESSAGES,
    {
      filter: client.filter ? client.filter('conversation = {:id}', { id: conversationId }) : '',
      expand: MESSAGE_EXPAND,
    },
    Boolean(conversationId && me),
    (event) => {
      if (event.action !== 'create') return;
      const message = toMessage(event.record);
      if (addToCache(queryClient, message) && message.senderId !== me) read.mutate();
    },
  );

  return useInfiniteQuery({
    queryKey: messageKeys.messages(conversationId),
    queryFn: ({ pageParam }) => listMessages(client, conversationId, pageParam),
    initialPageParam: null as MessageCursor | null,
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: Boolean(conversationId && me),
  });
}

export function useSendMessage(conversationId: string) {
  const { client, user } = useAuth();
  const me = user?.id ?? '';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => sendMessage(client, me, conversationId, text),
    onSuccess: (message) => {
      addToCache(queryClient, message);
      void queryClient.invalidateQueries({ queryKey: messageKeys.conversations(me) });
    },
  });
}

/**
 * Sends a post to a user by direct message (opening the conversation if needed), with an
 * optional note. Returns the conversation id.
 */
export function useSharePost() {
  const { client, user } = useAuth();
  const me = user?.id ?? '';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      postId,
      note,
    }: {
      userId: string;
      postId: string;
      note: string;
    }) => {
      const conversationId = await openConversation(client, me, userId);
      const message = await sendMessage(client, me, conversationId, note, postId);
      return { conversationId, message };
    },
    onSuccess: ({ message }) => {
      addToCache(queryClient, message);
      void queryClient.invalidateQueries({ queryKey: messageKeys.conversations(me) });
    },
  });
}

/** Message for a failed send: the field error (text, block…), or why it failed. */
export function messageErrorKey(error: unknown) {
  const fields = toFieldErrors(error);
  return (
    fields.text ??
    Object.values(fields)[0] ??
    requestErrorKey(requestErrorKind(error)) ??
    'errors.generic'
  );
}

/**
 * What the "Message" button of a profile does: visitors go to sign in; users open (or start)
 * the conversation.
 */
export function useMessageAction(): { open: (userId: string) => void; opening: boolean } {
  const { t } = useTranslation();
  const router = useRouter();
  const { client, user, status } = useAuth();
  const open = useMutation({
    mutationFn: (userId: string) => openConversation(client, user?.id ?? '', userId),
    onSuccess: (id) => router.push({ pathname: '/messages/[id]', params: { id } }),
  });
  return {
    opening: open.isPending,
    open: (userId) => {
      if (status !== 'signedIn') {
        router.push('/sign-in');
        return;
      }
      open.mutate(userId, {
        onError: (error) => notify(`${t('messages.failed')} ${t(messageErrorKey(error))}`),
      });
    },
  };
}
