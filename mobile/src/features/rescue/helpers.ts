import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import { toUser, type User } from '@/auth/AuthProvider';

export const RESCUE_HELPERS = 'rescue_helpers';
/** Same limit as the server (server/pb_migrations/…_rescue_helpers.js). */
export const HELP_MESSAGE_MAX = 500;

/** Someone who offered to help with a rescue report. */
export interface HelpOffer {
  id: string;
  reportId: string;
  helperId: string;
  /** Present when the helper was expanded. */
  helper?: User;
  message: string;
  created: string;
}

export function toHelpOffer(record: RecordModel): HelpOffer {
  const expand = (record.expand ?? {}) as { helper?: RecordModel };
  return {
    id: record.id,
    reportId: String(record.report ?? ''),
    helperId: String(record.helper ?? ''),
    helper: toUser(expand.helper) ?? undefined,
    message: String(record.message ?? ''),
    created: String(record.created ?? ''),
  };
}

/** The signed-in user's offer for a report, or `null`. */
export async function getMyOffer(
  client: PocketBase,
  me: string,
  reportId: string,
): Promise<HelpOffer | null> {
  const result = await client.collection(RESCUE_HELPERS).getList(1, 1, {
    filter: client.filter('report = {:report} && helper = {:me}', { report: reportId, me }),
    skipTotal: true,
  });
  const [record] = result.items;
  return record ? toHelpOffer(record) : null;
}

/** Everyone who offered to help with a report, oldest first (only its reporter sees them). */
export async function listHelpOffers(client: PocketBase, reportId: string): Promise<HelpOffer[]> {
  const records = await client.collection(RESCUE_HELPERS).getFullList({
    filter: client.filter('report = {:report}', { report: reportId }),
    sort: 'created,id',
    expand: 'helper',
  });
  return records.map(toHelpOffer);
}

export async function offerHelp(
  client: PocketBase,
  me: string,
  reportId: string,
  message: string,
): Promise<HelpOffer> {
  return toHelpOffer(
    await client
      .collection(RESCUE_HELPERS)
      .create({ report: reportId, helper: me, message: message.trim() }),
  );
}

export async function withdrawHelp(client: PocketBase, offerId: string): Promise<void> {
  await client.collection(RESCUE_HELPERS).delete(offerId);
}
