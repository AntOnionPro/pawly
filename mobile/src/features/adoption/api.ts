import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import { toUser, type User } from '@/auth/AuthProvider';
import { toPet, type Pet, type Species } from '@/features/pets/api';
import type { ComposerMedia } from '@/features/posts/media';
import { rangeStart, type DateRange } from '@/utils/dateRange';
import { appendFile, uploadFetch } from '@/utils/upload';

export const ADOPTIONS = 'adoptions';

/** Same values and limits as the server (server/pb_migrations/…_adoptions.js). */
export const SEXES = ['female', 'male'] as const;
export const SIZES = ['small', 'medium', 'large'] as const;
export const VACCINES = ['complete', 'partial', 'none'] as const;
export const ADOPTION_ZONE_MAX = 80;
export const ADOPTION_HEALTH_MAX = 500;
export const ADOPTION_REQUIREMENTS_MAX = 1000;
export const ADOPTION_DESCRIPTION_MAX = 2200;
export const ADOPTION_FILES_MAX = 10;

export type Sex = (typeof SEXES)[number];
export type Size = (typeof SIZES)[number];
export type Vaccines = (typeof VACCINES)[number];
export type AdoptionStatus = 'available' | 'adopted';

export interface Adoption {
  id: string;
  collectionId: string;
  publisherId: string;
  /** Present when the publisher was expanded. */
  publisher?: User;
  petId: string;
  /** Present when the pet was expanded: species, breed and age come from it. */
  pet?: Pet;
  sex: Sex;
  size: Size;
  vaccines: Vaccines;
  sterilized: boolean;
  health: string;
  zone: string;
  requirements: string;
  description: string;
  /** Stored file names, in order. */
  media: string[];
  status: AdoptionStatus;
  /** Who adopted the pet and when, once the listing is adopted ('' before). */
  adopterId: string;
  /** Present when the adopter was expanded. */
  adopter?: User;
  adoptedAt: string;
  created: string;
}

/** What the form edits. */
export interface AdoptionValues {
  petId: string;
  sex: Sex | '';
  size: Size | '';
  vaccines: Vaccines | '';
  sterilized: boolean;
  health: string;
  zone: string;
  requirements: string;
  description: string;
  /** Photos and videos to upload. */
  newMedia: ComposerMedia[];
  /** Stored files to remove (when editing). */
  removedMedia: string[];
}

/** Optional filters of the Adoption tab. */
export interface AdoptionFilter {
  species?: Species;
  size?: Size;
  sex?: Sex;
  /** Published today, in the last 7 days or in the last 30. */
  since?: DateRange;
  /** Text to find in the pet's name or breed, the description or the zone. */
  query?: string;
}

export interface AdoptionPage {
  items: Adoption[];
  page: number;
  hasMore: boolean;
}

export const ADOPTIONS_PER_PAGE = 12;
const EXPAND = 'pet,publisher,adopter';

function oneOf<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return values.includes(value as T) ? (value as T) : fallback;
}

export function toAdoption(record: RecordModel): Adoption {
  const expand = (record.expand ?? {}) as {
    pet?: RecordModel;
    publisher?: RecordModel;
    adopter?: RecordModel;
  };
  return {
    id: record.id,
    collectionId: record.collectionId,
    publisherId: String(record.publisher ?? ''),
    publisher: toUser(expand.publisher) ?? undefined,
    petId: String(record.pet ?? ''),
    pet: expand.pet ? toPet(expand.pet) : undefined,
    sex: oneOf(SEXES, record.sex, 'female'),
    size: oneOf(SIZES, record.size, 'medium'),
    vaccines: oneOf(VACCINES, record.vaccines, 'none'),
    sterilized: record.sterilized === true,
    health: String(record.health ?? ''),
    zone: String(record.zone ?? ''),
    requirements: String(record.requirements ?? ''),
    description: String(record.description ?? ''),
    media: Array.isArray(record.media) ? record.media.map(String) : [],
    status: record.status === 'adopted' ? 'adopted' : 'available',
    adopterId: String(record.adopter ?? ''),
    adopter: toUser(expand.adopter) ?? undefined,
    adoptedAt: String(record.adoptedAt ?? ''),
    created: String(record.created ?? ''),
  };
}

function filterExpression(client: PocketBase, filter: AdoptionFilter): string {
  const parts = ["status = 'available'"];
  if (filter.species) parts.push(client.filter('pet.species = {:species}', filter));
  if (filter.size) parts.push(client.filter('size = {:size}', filter));
  if (filter.sex) parts.push(client.filter('sex = {:sex}', filter));
  if (filter.since)
    parts.push(client.filter('created >= {:since}', { since: rangeStart(filter.since) }));
  const query = filter.query?.trim();
  if (query) {
    parts.push(
      client.filter(
        '(pet.name ~ {:query} || pet.breed ~ {:query} || description ~ {:query} || zone ~ {:query})',
        { query },
      ),
    );
  }
  return parts.join(' && ');
}

/** One page of available listings, newest first. */
export async function listAdoptions(
  client: PocketBase,
  filter: AdoptionFilter,
  page: number,
  perPage: number = ADOPTIONS_PER_PAGE,
): Promise<AdoptionPage> {
  const result = await client.collection(ADOPTIONS).getList(page, perPage, {
    filter: filterExpression(client, filter),
    sort: '-created,-id',
    expand: EXPAND,
    skipTotal: true,
  });
  return { items: result.items.map(toAdoption), page, hasMore: result.items.length === perPage };
}

export async function getAdoption(client: PocketBase, id: string): Promise<Adoption> {
  return toAdoption(await client.collection(ADOPTIONS).getOne(id, { expand: EXPAND }));
}

/** The available listing of a pet, or `null` when it is not up for adoption. */
export async function getPetAdoption(client: PocketBase, petId: string): Promise<Adoption | null> {
  const result = await client.collection(ADOPTIONS).getList(1, 1, {
    filter: client.filter("pet = {:pet} && status = 'available'", { pet: petId }),
    expand: EXPAND,
    skipTotal: true,
  });
  const [record] = result.items;
  return record ? toAdoption(record) : null;
}

/** The listing through which a pet was last adopted, or `null`. */
export async function getAdoptedListing(
  client: PocketBase,
  petId: string,
): Promise<Adoption | null> {
  const result = await client.collection(ADOPTIONS).getList(1, 1, {
    filter: client.filter("pet = {:pet} && status = 'adopted'", { pet: petId }),
    sort: '-adoptedAt',
    expand: EXPAND,
    skipTotal: true,
  });
  const [record] = result.items;
  return record ? toAdoption(record) : null;
}

/**
 * Marks a listing as adopted by the applicant of an accepted request: the pet moves to them
 * and the other open requests are rejected (server/pb_hooks/adoptions.pb.js).
 */
export async function completeAdoption(
  client: PocketBase,
  adoptionId: string,
  requestId: string,
): Promise<Adoption> {
  return toAdoption(
    await client.send(`/api/pawly/adoptions/${encodeURIComponent(adoptionId)}/adopt`, {
      method: 'POST',
      body: { request: requestId },
    }),
  );
}

async function toFormData(values: AdoptionValues, publisherId?: string): Promise<FormData> {
  const data = new FormData();
  if (publisherId) {
    data.append('publisher', publisherId);
    data.append('pet', values.petId);
  }
  data.append('sex', values.sex);
  data.append('size', values.size);
  data.append('vaccines', values.vaccines);
  data.append('sterilized', String(values.sterilized));
  data.append('health', values.health.trim());
  data.append('zone', values.zone.trim());
  data.append('requirements', values.requirements.trim());
  data.append('description', values.description.trim());
  for (const name of values.removedMedia) data.append('media-', name);
  for (const file of values.newMedia) {
    // When editing, "media+" adds to the stored files instead of replacing them.
    await appendFile(data, publisherId ? 'media' : 'media+', file);
  }
  return data;
}

export async function createAdoption(
  client: PocketBase,
  publisherId: string,
  values: AdoptionValues,
): Promise<Adoption> {
  return toAdoption(
    await client
      .collection(ADOPTIONS)
      .create(await toFormData(values, publisherId), { expand: EXPAND, fetch: uploadFetch }),
  );
}

export async function updateAdoption(
  client: PocketBase,
  id: string,
  values: AdoptionValues,
): Promise<Adoption> {
  return toAdoption(
    await client
      .collection(ADOPTIONS)
      .update(id, await toFormData(values), { expand: EXPAND, fetch: uploadFetch }),
  );
}

export async function deleteAdoption(client: PocketBase, id: string): Promise<void> {
  await client.collection(ADOPTIONS).delete(id);
}
