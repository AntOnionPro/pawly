import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
  /** Meters, when the phone reports it. */
  accuracy?: number | null;
}

/** The phone's location, or why it is not available. */
export type LocationResult =
  | { ok: true; coords: Coordinates }
  | { ok: false; reason: 'denied' | 'undetermined' | 'unavailable' };

/**
 * Reads where the phone is now. With `ask` (the default) it asks for the permission first;
 * without it, it only reads the location if the permission was already given.
 */
export async function getCurrentLocation({ ask = true } = {}): Promise<LocationResult> {
  try {
    const { status } = ask
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { ok: false, reason: status === 'undetermined' ? 'undetermined' : 'denied' };
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      ok: true,
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      },
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** Link that opens a point in the phone's maps app (or in the browser). */
export function mapsLink({ latitude, longitude }: Coordinates): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
