// Distances for nearby rescue alerts (loaded with require() from the hooks). Plain JavaScript
// (no PocketBase globals) so the Node tests can also import it.

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE = 111.32;
/** Saved alert locations are rounded to this many degrees: about 500 m. */
const ROUNDING_DEGREES = 0.005;
/** The nearby radii people can choose, in km. */
const RADII = [1, 5, 10, 25];

const radians = (degrees) => (degrees * Math.PI) / 180;

/** Distance in km between two points ({ latitude, longitude }). */
function distanceKm(a, b) {
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A coordinate rounded to about 500 m, so an alert never stores where someone is exactly. */
function roundCoordinate(value) {
  return Math.round(value / ROUNDING_DEGREES) * ROUNDING_DEGREES;
}

/** The latitude and longitude ranges that contain every point within `radiusKm` of `center`. */
function boundingBox(center, radiusKm) {
  const dLat = radiusKm / KM_PER_DEGREE;
  const dLng = radiusKm / (KM_PER_DEGREE * Math.max(0.01, Math.cos(radians(center.latitude))));
  return {
    minLat: center.latitude - dLat,
    maxLat: center.latitude + dLat,
    minLng: center.longitude - dLng,
    maxLng: center.longitude + dLng,
  };
}

/** "2", "1.5", "12": the distance in km as the alerts say it. */
function formatKm(km) {
  return String(km < 10 ? Math.max(0.1, Math.round(km * 10) / 10) : Math.round(km));
}

module.exports = { RADII, boundingBox, distanceKm, formatKm, roundCoordinate };
