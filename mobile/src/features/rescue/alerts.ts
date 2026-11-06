import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import type { Point } from '@/utils/geo';

export const RESCUE_ALERTS = 'rescue_alerts';
/** Saved alert locations are rounded to this many degrees: about 500 m (the server does too). */
const ROUNDING_DEGREES = 0.005;

/** Where (approximately) and how far the user wants to hear about new rescue cases. */
export interface RescueAlert {
  id: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
}

export function roundForAlert(value: number): number {
  return Math.round(Math.round(value / ROUNDING_DEGREES) * ROUNDING_DEGREES * 1000) / 1000;
}

function toAlert(record: RecordModel): RescueAlert {
  return {
    id: record.id,
    latitude: Number(record.latitude ?? 0),
    longitude: Number(record.longitude ?? 0),
    radiusKm: Number(record.radiusKm ?? 5),
  };
}

/** The user's nearby alert, or `null` when they did not turn it on. */
export async function getMyAlert(client: PocketBase, me: string): Promise<RescueAlert | null> {
  const result = await client.collection(RESCUE_ALERTS).getList(1, 1, {
    filter: client.filter('user = {:me}', { me }),
    skipTotal: true,
  });
  const [record] = result.items;
  return record ? toAlert(record) : null;
}

/** Saves the alert with an approximate location: creates it, or updates it when `id` is given. */
export async function saveAlert(
  client: PocketBase,
  me: string,
  id: string | null,
  point: Point,
  radiusKm: number,
): Promise<RescueAlert> {
  const body = {
    latitude: roundForAlert(point.latitude),
    longitude: roundForAlert(point.longitude),
    radiusKm,
  };
  const record = id
    ? await client.collection(RESCUE_ALERTS).update(id, body)
    : await client.collection(RESCUE_ALERTS).create({ user: me, ...body });
  return toAlert(record);
}

/** Turns the alert off: the saved location is deleted. */
export async function deleteAlert(client: PocketBase, id: string): Promise<void> {
  await client.collection(RESCUE_ALERTS).delete(id);
}
