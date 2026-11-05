import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import { toPost, type Post } from '@/features/posts/api';
import { parseServerDate } from '@/utils/time';

export const FOLLOWUPS = 'adoption_followups';
/** Days after its date that a follow-up waits for an update (server/pb_hooks/lib/followups.js). */
export const FOLLOWUP_GRACE_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

export const MILESTONES = ['week1', 'month1', 'month3', 'month6'] as const;
export type Milestone = (typeof MILESTONES)[number];

export interface Followup {
  id: string;
  adoptionId: string;
  milestone: Milestone;
  /** When the adopter should share an update. */
  dueAt: string;
  /** The post that counted as the update ('' until then), and the post when expanded. */
  postId: string;
  post?: Post;
}

/** upcoming: before its date. due: waiting for an update. done: updated. overdue: missed. */
export type FollowupState = 'upcoming' | 'due' | 'done' | 'overdue';

export function toFollowup(record: RecordModel): Followup {
  const expand = (record.expand ?? {}) as { post?: RecordModel };
  return {
    id: record.id,
    adoptionId: String(record.adoption ?? ''),
    milestone: MILESTONES.find((value) => value === record.milestone) ?? 'week1',
    dueAt: String(record.dueAt ?? ''),
    postId: String(record.post ?? ''),
    post: expand.post ? toPost(expand.post) : undefined,
  };
}

/** The last day an update counts for a follow-up. */
export function followupDeadline(followup: Followup): Date | null {
  const due = parseServerDate(followup.dueAt);
  return due ? new Date(due.getTime() + FOLLOWUP_GRACE_DAYS * DAY) : null;
}

export function followupState(followup: Followup, now: Date = new Date()): FollowupState {
  if (followup.postId) return 'done';
  const due = parseServerDate(followup.dueAt);
  const deadline = followupDeadline(followup);
  if (!due || !deadline) return 'upcoming';
  if (now < due) return 'upcoming';
  return now < deadline ? 'due' : 'overdue';
}

/** The four follow-ups of an adopted listing (only its adopter and previous owner see them). */
export async function listFollowups(client: PocketBase, adoptionId: string): Promise<Followup[]> {
  const records = await client.collection(FOLLOWUPS).getFullList({
    filter: client.filter('adoption = {:adoption}', { adoption: adoptionId }),
    sort: 'dueAt',
    expand: 'post',
  });
  return records.map(toFollowup);
}
