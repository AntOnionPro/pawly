import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import type { PickedImage } from '@/utils/pickPhoto';
import { appendFile, uploadFetch } from '@/utils/upload';

export const PETS = 'pets';

export const SPECIES = [
  'dog',
  'cat',
  'bird',
  'rabbit',
  'rodent',
  'reptile',
  'fish',
  'other',
] as const;
export type Species = (typeof SPECIES)[number];

export const PET_NAME_MAX = 40;
export const PET_BREED_MAX = 60;

export interface Pet {
  id: string;
  collectionId: string;
  ownerId: string;
  /** Present when the owner was expanded. */
  ownerUsername?: string;
  name: string;
  species: Species;
  breed: string;
  /** "YYYY-MM-DD", or empty when unknown. */
  birthDate: string;
  photo: string;
}

export interface PetValues {
  name: string;
  species: Species | '';
  breed: string;
  /** "YYYY-MM-DD", or empty. */
  birthDate: string;
  /** New photo, `null` to remove it, or leave out to keep it. */
  photo?: PickedImage | null;
}

function isSpecies(value: unknown): value is Species {
  return SPECIES.includes(value as Species);
}

export function toPet(record: RecordModel): Pet {
  const owner = (record.expand as { owner?: RecordModel } | undefined)?.owner;
  return {
    id: record.id,
    collectionId: record.collectionId,
    ownerId: String(record.owner ?? ''),
    ownerUsername: owner ? String(owner.username ?? '') : undefined,
    name: String(record.name ?? ''),
    species: isSpecies(record.species) ? record.species : 'other',
    breed: String(record.breed ?? ''),
    birthDate: String(record.birthDate ?? '').slice(0, 10),
    photo: String(record.photo ?? ''),
  };
}

export function petPhotoUrl(client: PocketBase, pet: Pet, thumb = '400x400'): string | null {
  if (!pet.photo) return null;
  return client.files.getURL(
    { id: pet.id, collectionId: pet.collectionId, collectionName: PETS },
    pet.photo,
    { thumb },
  );
}

/** A user's pets, oldest first. */
export async function listPets(client: PocketBase, ownerId: string): Promise<Pet[]> {
  const records = await client.collection(PETS).getFullList({
    filter: client.filter('owner = {:owner}', { owner: ownerId }),
    sort: 'created',
  });
  return records.map(toPet);
}

export async function getPet(client: PocketBase, id: string): Promise<Pet> {
  return toPet(await client.collection(PETS).getOne(id, { expand: 'owner' }));
}

async function toFormData(values: PetValues, ownerId?: string): Promise<FormData> {
  const data = new FormData();
  if (ownerId) data.append('owner', ownerId);
  data.append('name', values.name.trim());
  data.append('species', values.species);
  data.append('breed', values.breed.trim());
  data.append('birthDate', values.birthDate);
  if (values.photo === null) {
    data.append('photo', '');
  } else if (values.photo) {
    await appendFile(data, 'photo', values.photo);
  }
  return data;
}

export async function createPet(
  client: PocketBase,
  ownerId: string,
  values: PetValues,
): Promise<Pet> {
  return toPet(
    await client.collection(PETS).create(await toFormData(values, ownerId), { fetch: uploadFetch }),
  );
}

export async function updatePet(client: PocketBase, id: string, values: PetValues): Promise<Pet> {
  return toPet(
    await client.collection(PETS).update(id, await toFormData(values), { fetch: uploadFetch }),
  );
}

export async function deletePet(client: PocketBase, id: string): Promise<void> {
  await client.collection(PETS).delete(id);
}
