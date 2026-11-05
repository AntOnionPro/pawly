import type PocketBase from 'pocketbase';
import { ClientResponseError, type RecordModel } from 'pocketbase';

import { toUser, type User } from '@/auth/AuthProvider';

export const REPORTS = 'reports';
export const BLOCKS = 'blocks';
/** Same limit as the server (server/pb_migrations/…_moderation.js). */
export const REPORT_DETAILS_MAX = 500;

export type ReportReason = 'spam' | 'offensive' | 'animal_abuse' | 'animal_sale' | 'other';

export const REPORT_REASONS: readonly ReportReason[] = [
  'spam',
  'offensive',
  'animal_abuse',
  'animal_sale',
  'other',
];

export type ReportKind = 'post' | 'comment' | 'user' | 'message';

export interface ReportTarget {
  kind: ReportKind;
  id: string;
}

export function isReportKind(value: unknown): value is ReportKind {
  return value === 'post' || value === 'comment' || value === 'user' || value === 'message';
}

/** Reports a post, a comment, a user or a message. Only the administrators see reports. */
export async function sendReport(
  client: PocketBase,
  reporterId: string,
  target: ReportTarget,
  reason: ReportReason,
  details: string,
): Promise<void> {
  await client.collection(REPORTS).create({
    reporter: reporterId,
    [target.kind]: target.id,
    reason,
    details: details.trim(),
  });
}

/** Whether the server rejected a report because the user already reported the same thing. */
export function isAlreadyReported(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) return false;
  const data = (error.response?.data ?? {}) as Record<string, { code?: string } | undefined>;
  return Object.values(data).some((detail) => detail?.code === 'validation_not_unique');
}

export interface Block {
  id: string;
  blockedId: string;
  /** Present when the blocked user was expanded. */
  blocked?: User;
}

function toBlock(record: RecordModel): Block {
  const blocked = (record.expand as { blocked?: RecordModel } | undefined)?.blocked;
  return {
    id: record.id,
    blockedId: String(record.blocked ?? ''),
    blocked: toUser(blocked) ?? undefined,
  };
}

/** Everyone the user blocked, most recent first. */
export async function listBlocks(client: PocketBase, blockerId: string): Promise<Block[]> {
  const records = await client.collection(BLOCKS).getFullList({
    filter: client.filter('blocker = {:blocker}', { blocker: blockerId }),
    sort: '-created,-id',
    expand: 'blocked',
  });
  return records.map(toBlock);
}

export async function blockUser(
  client: PocketBase,
  blockerId: string,
  userId: string,
): Promise<void> {
  await client.collection(BLOCKS).create({ blocker: blockerId, blocked: userId });
}

export async function unblockUser(client: PocketBase, blockId: string): Promise<void> {
  await client.collection(BLOCKS).delete(blockId);
}
