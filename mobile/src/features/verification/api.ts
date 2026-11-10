import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import { ACCOUNT_KINDS, type AccountKind } from '@/auth/AuthProvider';
import { appendFile, uploadFetch, type UploadFile } from '@/utils/upload';

export const VERIFICATION_REQUESTS = 'verification_requests';

/** Same limits as the server (server/pb_migrations/…_account_verification.js). */
export const PUBLIC_NAME_MIN = 3;
export const PUBLIC_NAME_MAX = 60;
export const ABOUT_MAX = 1000;
export const LINKS_MAX = 500;
export const DOCUMENTS_MAX = 5;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

/**
 * pending: in review. approved: the account is verified. rejected: with a reason.
 * revoked: Pawly took the verification back. replaced: a newer request was approved.
 */
export const VERIFICATION_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'revoked',
  'replaced',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface VerificationRequest {
  id: string;
  kind: AccountKind;
  publicName: string;
  about: string;
  links: string;
  /** Stored file names. Only the applicant and Pawly can open them. */
  documents: string[];
  status: VerificationStatus;
  /** Why it was rejected or revoked. */
  reviewNote: string;
  created: string;
}

/** What the form sends. */
export interface VerificationValues {
  kind: AccountKind | '';
  publicName: string;
  about: string;
  links: string;
  documents: UploadFile[];
}

export function toVerificationRequest(record: RecordModel): VerificationRequest {
  return {
    id: record.id,
    kind: ACCOUNT_KINDS.find((kind) => kind === record.kind) ?? 'rescuer',
    publicName: String(record.publicName ?? ''),
    about: String(record.about ?? ''),
    links: String(record.links ?? ''),
    documents: Array.isArray(record.documents) ? record.documents.map(String) : [],
    status: VERIFICATION_STATUSES.find((status) => status === record.status) ?? 'pending',
    reviewNote: String(record.reviewNote ?? ''),
    created: String(record.created ?? ''),
  };
}

/** The newest request of the signed-in user, or `null` if they never asked. */
export async function getLatestVerification(
  client: PocketBase,
  userId: string,
): Promise<VerificationRequest | null> {
  const result = await client.collection(VERIFICATION_REQUESTS).getList(1, 1, {
    filter: client.filter('user = {:user}', { user: userId }),
    sort: '-created,-id',
    skipTotal: true,
  });
  const [record] = result.items;
  return record ? toVerificationRequest(record) : null;
}

export async function sendVerification(
  client: PocketBase,
  userId: string,
  values: VerificationValues,
): Promise<VerificationRequest> {
  const data = new FormData();
  data.append('user', userId);
  data.append('kind', values.kind);
  data.append('publicName', values.publicName.trim());
  data.append('about', values.about.trim());
  data.append('links', values.links.trim());
  // Only a constituted shelter sends documents.
  for (const file of values.kind === 'shelter' ? values.documents : []) {
    await appendFile(data, 'documents', file);
  }
  return toVerificationRequest(
    await client.collection(VERIFICATION_REQUESTS).create(data, { fetch: uploadFetch }),
  );
}

/** Cancels a request that is still in review. */
export async function cancelVerification(client: PocketBase, id: string): Promise<void> {
  await client.collection(VERIFICATION_REQUESTS).delete(id);
}
