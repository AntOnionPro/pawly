import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import { toUser, type User } from '@/auth/AuthProvider';

import { toAdoption, type Adoption } from './api';

export const ADOPTION_REQUESTS = 'adoption_requests';
/** Same limit as the server (server/pb_migrations/…_adoption_requests.js). */
export const REQUEST_MESSAGE_MAX = 1000;

export const REQUEST_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface AdoptionRequest {
  id: string;
  adoptionId: string;
  /** Present when the listing was expanded (with its pet and publisher). */
  adoption?: Adoption;
  applicantId: string;
  /** Present when the applicant was expanded. */
  applicant?: User;
  message: string;
  status: RequestStatus;
  created: string;
}

export function toAdoptionRequest(record: RecordModel): AdoptionRequest {
  const expand = (record.expand ?? {}) as { adoption?: RecordModel; applicant?: RecordModel };
  const status = REQUEST_STATUSES.find((value) => value === record.status) ?? 'pending';
  return {
    id: record.id,
    adoptionId: String(record.adoption ?? ''),
    adoption: expand.adoption ? toAdoption(expand.adoption) : undefined,
    applicantId: String(record.applicant ?? ''),
    applicant: toUser(expand.applicant) ?? undefined,
    message: String(record.message ?? ''),
    status,
    created: String(record.created ?? ''),
  };
}

/** The signed-in user's request for a listing, or `null` if they did not send one. */
export async function getMyRequest(
  client: PocketBase,
  me: string,
  adoptionId: string,
): Promise<AdoptionRequest | null> {
  const result = await client.collection(ADOPTION_REQUESTS).getList(1, 1, {
    filter: client.filter('adoption = {:adoption} && applicant = {:me}', {
      adoption: adoptionId,
      me,
    }),
    skipTotal: true,
  });
  const [record] = result.items;
  return record ? toAdoptionRequest(record) : null;
}

/** Requests for one listing (only its publisher sees them), newest first. */
export async function listAdoptionRequests(
  client: PocketBase,
  adoptionId: string,
): Promise<AdoptionRequest[]> {
  const records = await client.collection(ADOPTION_REQUESTS).getFullList({
    filter: client.filter('adoption = {:adoption}', { adoption: adoptionId }),
    sort: '-created,-id',
    expand: 'applicant',
  });
  return records.map(toAdoptionRequest);
}

/** How many requests of a listing wait for an answer. */
export async function countPendingRequests(
  client: PocketBase,
  adoptionId: string,
): Promise<number> {
  const result = await client.collection(ADOPTION_REQUESTS).getList(1, 1, {
    filter: client.filter("adoption = {:adoption} && status = 'pending'", {
      adoption: adoptionId,
    }),
    fields: 'id',
  });
  return result.totalItems;
}

/** The requests the user sent, newest first, with their listing, pet and publisher. */
export async function listSentRequests(client: PocketBase, me: string): Promise<AdoptionRequest[]> {
  const records = await client.collection(ADOPTION_REQUESTS).getFullList({
    filter: client.filter('applicant = {:me}', { me }),
    sort: '-created,-id',
    expand: 'adoption,adoption.pet,adoption.publisher',
  });
  return records.map(toAdoptionRequest);
}

export async function sendAdoptionRequest(
  client: PocketBase,
  me: string,
  adoptionId: string,
  message: string,
): Promise<AdoptionRequest> {
  return toAdoptionRequest(
    await client
      .collection(ADOPTION_REQUESTS)
      .create({ adoption: adoptionId, applicant: me, message: message.trim() }),
  );
}

/** Accepts, rejects or withdraws a request (the server checks who can do what). */
export async function setRequestStatus(
  client: PocketBase,
  id: string,
  status: RequestStatus,
): Promise<AdoptionRequest> {
  return toAdoptionRequest(
    await client.collection(ADOPTION_REQUESTS).update(id, { status }, { expand: 'applicant' }),
  );
}
