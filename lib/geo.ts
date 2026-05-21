/**
 * Rough country anchor points used to compute provider weights.
 * SMHI is most authoritative for Sweden; DMI for Denmark. For points
 * outside both (or in the sea), we blend by distance.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

/** Haversine distance in km between two lat/lon points. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Approximate "country distance" using a list of representative points.
 * Returns the min distance (km) to the closest anchor in the set.
 */
function minDistanceTo(points: LatLon[], target: LatLon): number {
  let best = Infinity;
  for (const p of points) {
    const d = haversineKm(p, target);
    if (d < best) best = d;
  }
  return best;
}

// A handful of geographic anchors spanning each country. Doesn't need to be
// dense — we only care about a smooth distance gradient.
const SWEDEN: LatLon[] = [
  { lat: 55.6, lon: 13.0 },   // Malmö
  { lat: 57.7, lon: 11.97 },  // Göteborg
  { lat: 59.33, lon: 18.07 }, // Stockholm
  { lat: 60.67, lon: 17.14 }, // Gävle
  { lat: 63.83, lon: 20.26 }, // Umeå
  { lat: 65.58, lon: 22.15 }, // Luleå
  { lat: 67.85, lon: 20.23 }, // Kiruna
];

const DENMARK: LatLon[] = [
  { lat: 55.68, lon: 12.57 }, // København
  { lat: 56.16, lon: 10.2 },  // Aarhus
  { lat: 55.4, lon: 10.4 },   // Odense
  { lat: 57.05, lon: 9.92 },  // Aalborg
  { lat: 55.49, lon: 8.45 },  // Esbjerg
];

/**
 * Compute provider weights based on location.
 *  - Locations inside / near Sweden → SMHI dominant
 *  - Locations inside / near Denmark → DMI dominant
 *  - Open-Meteo gets a fixed 20% baseline (global model)
 *  - SMHI + DMI share the remaining 80% by inverse distance
 *  - Far from both → Open-Meteo rises to ~50%, SMHI/DMI split the rest
 */
export function providerWeights(at: LatLon): {
  smhi: number;
  dmi: number;
  openmeteo: number;
} {
  const dSE = minDistanceTo(SWEDEN, at);
  const dDK = minDistanceTo(DENMARK, at);

  const SMOOTH = 50;
  const wSE = 1 / (dSE + SMOOTH);
  const wDK = 1 / (dDK + SMOOTH);
  const totalLocal = wSE + wDK;

  // Open-Meteo baseline: 20% when close to SE/DK, grows when far from both.
  // Far-distance factor: as min(dSE,dDK) grows beyond 500km, OM weight rises.
  const minDist = Math.min(dSE, dDK);
  const omBase = 0.2 + 0.3 * Math.min(1, Math.max(0, (minDist - 100) / 500));

  const localShare = 1 - omBase;
  const smhi = localShare * (wSE / totalLocal);
  const dmi = localShare * (wDK / totalLocal);

  return { smhi, dmi, openmeteo: omBase };
}
