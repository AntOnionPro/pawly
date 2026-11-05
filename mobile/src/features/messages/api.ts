import type PocketBase from 'pocketbase';
import { ClientResponseError, type RecordModel } from 'pocketbase';

import { toUser, type User } from '@/auth/AuthProvider';
import { parseServerDate } from '@/utils/time';

export const CONVERSATIONS = 'conversations';
export const MESSAGES = 'messages';
/** Same limit as the server (server/pb_migrations/…_messages.js). */
export const MESSAGE_TEXT_MAX = 1000;
export const CONVERSATIONS_PER_PAGE = 30;
export const MESSAGES_PER_PAGE = 30;

export interface Conversation {
  id: string;
  otherId: string;
  /** The other participant, when expanded. */
  other?: User;
  lastMessageText: string;
  lastMessageAt: string;
  lastSenderId: string;
  /** Whether the other participant wrote after the user last read it. */
  unread: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  created: string;
}

export interface ConversationPage {
  items: Conversation[];
  page: number;
  hasMore: boolean;
}

/** Where a page of messages ends: the next (older) page starts before this message. */
export interface MessageCursor {
  created: string;
  id: string;
}

export interface MessagePage {
  /** Newest first. */
  items: Message[];
  next: MessageCursor | null;
}

export function toConversation(record: RecordModel, me: string): Conversation {
  const expand = (record.expand ?? {}) as { userA?: RecordModel; userB?: RecordModel };
  const iAmA = String(record.userA ?? '') === me;
  const otherId = String((iAmA ? record.userB : record.userA) ?? '');
  const lastMessageAt = String(record.lastMessageAt ?? '');
  const lastSenderId = String(record.lastSender ?? '');
  const read = parseServerDate(String((iAmA ? record.readA : record.readB) ?? ''));
  const last = parseServerDate(lastMessageAt);
  return {
    id: record.id,
    otherId,
    other: toUser(iAmA ? expand.userB : expand.userA) ?? undefined,
    lastMessageText: String(record.lastMessageText ?? ''),
    lastMessageAt,
    lastSenderId,
    unread: Boolean(last && lastSenderId !== me && (!read || read < last)),
  };
}

export function toMessage(record: RecordModel): Message {
  return {
    id: record.id,
    conversationId: String(record.conversation ?? ''),
    senderId: String(record.sender ?? ''),
    text: String(record.text ?? ''),
    created: String(record.created ?? ''),
  };
}

function participantFilter(client: PocketBase, me: string): string {
  return client.filter('(userA = {:me} || userB = {:me})', { me });
}

/** Conversations with at least one message, the most recent first. */
export async function listConversations(
  client: PocketBase,
  me: string,
  page: number,
  perPage: number = CONVERSATIONS_PER_PAGE,
): Promise<ConversationPage> {
  const result = await client.collection(CONVERSATIONS).getList(page, perPage, {
    filter: `${participantFilter(client, me)} && lastMessageAt != ''`,
    sort: '-lastMessageAt,-id',
    expand: 'userA,userB',
    skipTotal: true,
  });
  return {
    items: result.items.map((record) => toConversation(record, me)),
    page,
    hasMore: result.items.length === perPage,
  };
}

/** How many conversations have messages the user has not read. */
export async function countUnread(client: PocketBase, me: string): Promise<number> {
  const result = await client.collection(CONVERSATIONS).getList(1, 1, {
    filter: client.filter(
      "lastSender != {:me} && lastMessageAt != '' && ((userA = {:me} && (readA = '' || readA < lastMessageAt)) || (userB = {:me} && (readB = '' || readB < lastMessageAt)))",
      { me },
    ),
    fields: 'id',
  });
  return result.totalItems;
}

export async function getConversation(
  client: PocketBase,
  id: string,
  me: string,
): Promise<Conversation> {
  return toConversation(
    await client.collection(CONVERSATIONS).getOne(id, { expand: 'userA,userB' }),
    me,
  );
}

async function findConversation(
  client: PocketBase,
  me: string,
  otherId: string,
): Promise<string | null> {
  const [userA, userB] = [me, otherId].sort();
  const result = await client.collection(CONVERSATIONS).getList(1, 1, {
    filter: client.filter('userA = {:a} && userB = {:b}', { a: userA, b: userB }),
    fields: 'id',
    skipTotal: true,
  });
  return result.items[0]?.id ?? null;
}

/** Id of the conversation with `otherId`, created if it does not exist yet. */
export async function openConversation(
  client: PocketBase,
  me: string,
  otherId: string,
): Promise<string> {
  const existing = await findConversation(client, me, otherId);
  if (existing) return existing;
  try {
    const created = await client.collection(CONVERSATIONS).create({ userA: me, userB: otherId });
    return created.id;
  } catch (error) {
    // Someone else may have created it at the same time (the pair is unique).
    const data = error instanceof ClientResponseError ? error.response?.data : undefined;
    const raced = Object.values((data ?? {}) as Record<string, { code?: string }>).some(
      (detail) => detail?.code === 'validation_not_unique',
    );
    const again = raced ? await findConversation(client, me, otherId) : null;
    if (again) return again;
    throw error;
  }
}

/** One page of messages, newest first; the next page has the older ones. */
export async function listMessages(
  client: PocketBase,
  conversationId: string,
  before: MessageCursor | null,
  perPage: number = MESSAGES_PER_PAGE,
): Promise<MessagePage> {
  const filters = [client.filter('conversation = {:id}', { id: conversationId })];
  if (before) {
    filters.push(
      client.filter('(created < {:created} || (created = {:created} && id < {:id}))', {
        created: before.created,
        id: before.id,
      }),
    );
  }
  const result = await client.collection(MESSAGES).getList(1, perPage, {
    filter: filters.join(' && '),
    sort: '-created,-id',
    skipTotal: true,
  });
  const items = result.items.map(toMessage);
  const oldest = items[items.length - 1];
  return {
    items,
    next: items.length === perPage && oldest ? { created: oldest.created, id: oldest.id } : null,
  };
}

export async function sendMessage(
  client: PocketBase,
  me: string,
  conversationId: string,
  text: string,
): Promise<Message> {
  return toMessage(
    await client
      .collection(MESSAGES)
      .create({ conversation: conversationId, sender: me, text: text.trim() }),
  );
}

/** Marks the conversation as read up to now (the server sets the date). */
export async function markRead(client: PocketBase, conversationId: string): Promise<void> {
  await client.collection(CONVERSATIONS).update(conversationId, {});
}
