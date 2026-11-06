/** A point on the map. */
export interface Point {
  latitude: number;
  longitude: number;
}

/** The area a map shows: its center and how many degrees it spans. */
export interface Region extends Point {
  latitudeDelta: number;
  longitudeDelta: number;
}

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE = 111.32;

/** Mexico City: where maps start when there is no location yet. */
export const DEFAULT_POINT: Point = { latitude: 19.4326, longitude: -99.1332 };

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Distance in km between two points, along the surface of the Earth. */
export function distanceKm(a: Point, b: Point): number {
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Degrees of longitude per km at a latitude (more of them near the poles). */
function lngDegreesPerKm(latitude: number): number {
  return 1 / (KM_PER_DEGREE * Math.max(0.01, Math.cos(radians(latitude))));
}

/** The square that contains every point within `radiusKm` of `center`. */
export function boundingBox(
  center: Point,
  radiusKm: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const dLat = radiusKm / KM_PER_DEGREE;
  const dLng = radiusKm * lngDegreesPerKm(center.latitude);
  return {
    minLat: center.latitude - dLat,
    maxLat: center.latitude + dLat,
    minLng: center.longitude - dLng,
    maxLng: center.longitude + dLng,
  };
}

/** A map region that shows `radiusKm` around `center`, with a little margin. */
export function regionAround(center: Point, radiusKm: number): Region {
  return {
    ...center,
    latitudeDelta: (radiusKm / KM_PER_DEGREE) * 2.2,
    longitudeDelta: radiusKm * lngDegreesPerKm(center.latitude) * 2.2,
  };
}
