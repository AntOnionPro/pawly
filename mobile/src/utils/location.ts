import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
  /** Meters, when the phone reports it. */
  accuracy?: number | null;
}

/** The phone's location, or why it is not available. */
export type LocationResult =
  { ok: true; coords: Coordinates } | { ok: false; reason: 'denied' | 'unavailable' };

/** Asks for the location permission (if needed) and reads where the phone is now. */
export async function getCurrentLocation(): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'denied' };
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
