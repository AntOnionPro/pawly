import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import { toUser, type User } from '@/auth/AuthProvider';
import { toPet, type Pet } from '@/features/pets/api';
import type { ComposerMedia } from '@/features/posts/media';
import { boundingBox, distanceKm, type Point } from '@/utils/geo';
import { appendFile, uploadFetch } from '@/utils/upload';

export const RESCUE_REPORTS = 'rescue_reports';

/** Same values and limits as the server (server/pb_migrations/…_rescue_reports.js). */
export const RESCUE_KINDS = ['help', 'lost', 'found'] as const;
export const URGENCIES = ['low', 'medium', 'high'] as const;
export const RESCUE_DESCRIPTION_MAX = 2200;
export const RESCUE_PLACE_MAX = 120;
export const RESCUE_FILES_MAX = 10;

export type RescueKind = (typeof RESCUE_KINDS)[number];
export type Urgency = (typeof URGENCIES)[number];
/** open: open, lost or found. in_progress: only for help. closed: resolved or reunited. */
export type RescueStatus = 'open' | 'in_progress' | 'closed';

export interface RescueReport {
  id: string;
  collectionId: string;
  reporterId: string;
  /** Present when the reporter was expanded. */
  reporter?: User;
  kind: RescueKind;
  description: string;
  /** Stored file names, in order. */
  media: string[];
  latitude: number;
  longitude: number;
  place: string;
  urgency: Urgency | '';
  /** For lost pets: the pet (when expanded) and when it was last seen. */
  petId: string;
  pet?: Pet;
  lastSeenAt: string;
  status: RescueStatus;
  created: string;
}

/** What the form edits. */
export interface RescueValues {
  kind: RescueKind | '';
  description: string;
  place: string;
  urgency: Urgency | '';
  petId: string;
  /** "YYYY-MM-DD", for lost pets. */
  lastSeenDate: string;
  latitude: number | null;
  longitude: number | null;
  /** Photos and videos to upload. */
  newMedia: ComposerMedia[];
  /** Stored files to remove (when editing). */
  removedMedia: string[];
}

export interface RescueFilter {
  kind?: RescueKind;
}

export interface RescuePage {
  items: RescueReport[];
  page: number;
  hasMore: boolean;
}

export const RESCUE_PER_PAGE = 20;
const EXPAND = 'reporter,pet';

function oneOf<T extends string>(values: readonly T[], value: unknown): T | undefined {
  return values.find((item) => item === value);
}

export function toRescueReport(record: RecordModel): RescueReport {
  const expand = (record.expand ?? {}) as { reporter?: RecordModel; pet?: RecordModel };
  return {
    id: record.id,
    collectionId: record.collectionId,
    reporterId: String(record.reporter ?? ''),
    reporter: toUser(expand.reporter) ?? undefined,
    kind: oneOf(RESCUE_KINDS, record.kind) ?? 'help',
    description: String(record.description ?? ''),
    media: Array.isArray(record.media) ? record.media.map(String) : [],
    latitude: Number(record.latitude ?? 0),
    longitude: Number(record.longitude ?? 0),
    place: String(record.place ?? ''),
    urgency: oneOf(URGENCIES, record.urgency) ?? '',
    petId: String(record.pet ?? ''),
    pet: expand.pet ? toPet(expand.pet) : undefined,
    lastSeenAt: String(record.lastSeenAt ?? ''),
    status: oneOf(['open', 'in_progress', 'closed'] as const, record.status) ?? 'open',
    created: String(record.created ?? ''),
  };
}

/** One page of the reports that are still open (or in progress), newest first. */
export async function listRescueReports(
  client: PocketBase,
  filter: RescueFilter,
  page: number,
  perPage: number = RESCUE_PER_PAGE,
): Promise<RescuePage> {
  const parts = ["status != 'closed'"];
  if (filter.kind) parts.push(client.filter('kind = {:kind}', { kind: filter.kind }));
  const result = await client.collection(RESCUE_REPORTS).getList(page, perPage, {
    filter: parts.join(' && '),
    sort: '-created,-id',
    expand: EXPAND,
    skipTotal: true,
  });
  return {
    items: result.items.map(toRescueReport),
    page,
    hasMore: result.items.length === perPage,
  };
}

/** A report with how far it is from the person looking. */
export type NearbyReport = RescueReport & { distanceKm: number };

/** Most nearby reports the app loads at once; a radius of 25 km rarely has more open cases. */
export const NEARBY_MAX = 200;

/**
 * Open reports within `radiusKm` of `center`, nearest first. The server filters by the square
 * around the circle (latitude and longitude); the app keeps the ones inside the circle.
 */
export async function listNearbyRescueReports(
  client: PocketBase,
  center: Point,
  radiusKm: number,
  filter: RescueFilter,
): Promise<NearbyReport[]> {
  const box = boundingBox(center, radiusKm);
  const parts = [
    "status != 'closed'",
    client.filter(
      'latitude >= {:minLat} && latitude <= {:maxLat} && longitude >= {:minLng} && longitude <= {:maxLng}',
      box,
    ),
  ];
  if (filter.kind) parts.push(client.filter('kind = {:kind}', { kind: filter.kind }));
  const result = await client.collection(RESCUE_REPORTS).getList(1, NEARBY_MAX, {
    filter: parts.join(' && '),
    sort: '-created,-id',
    expand: EXPAND,
    skipTotal: true,
  });
  return result.items
    .map(toRescueReport)
    .map((report) => ({ ...report, distanceKm: distanceKm(center, report) }))
    .filter((report) => report.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function getRescueReport(client: PocketBase, id: string): Promise<RescueReport> {
  return toRescueReport(await client.collection(RESCUE_REPORTS).getOne(id, { expand: EXPAND }));
}

async function toFormData(values: RescueValues, reporterId?: string): Promise<FormData> {
  const data = new FormData();
  if (reporterId) {
    data.append('reporter', reporterId);
    data.append('kind', values.kind);
  }
  data.append('description', values.description.trim());
  data.append('place', values.place.trim());
  data.append('urgency', values.kind === 'help' ? values.urgency : '');
  data.append('pet', values.kind === 'lost' ? values.petId : '');
  data.append(
    'lastSeenAt',
    values.kind === 'lost' && values.lastSeenDate ? `${values.lastSeenDate} 12:00:00.000Z` : '',
  );
  data.append('latitude', String(values.latitude ?? 0));
  data.append('longitude', String(values.longitude ?? 0));
  for (const name of values.removedMedia) data.append('media-', name);
  for (const file of values.newMedia) {
    // When editing, "media+" adds to the stored files instead of replacing them.
    await appendFile(data, reporterId ? 'media' : 'media+', file);
  }
  return data;
}

export async function createRescueReport(
  client: PocketBase,
  reporterId: string,
  values: RescueValues,
): Promise<RescueReport> {
  return toRescueReport(
    await client
      .collection(RESCUE_REPORTS)
      .create(await toFormData(values, reporterId), { expand: EXPAND, fetch: uploadFetch }),
  );
}

export async function updateRescueReport(
  client: PocketBase,
  id: string,
  values: RescueValues,
): Promise<RescueReport> {
  return toRescueReport(
    await client
      .collection(RESCUE_REPORTS)
      .update(id, await toFormData(values), { expand: EXPAND, fetch: uploadFetch }),
  );
}

export async function setRescueStatus(
  client: PocketBase,
  id: string,
  status: RescueStatus,
): Promise<RescueReport> {
  return toRescueReport(
    await client.collection(RESCUE_REPORTS).update(id, { status }, { expand: EXPAND }),
  );
}

export async function deleteRescueReport(client: PocketBase, id: string): Promise<void> {
  await client.collection(RESCUE_REPORTS).delete(id);
}
