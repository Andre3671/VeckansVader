/**
 * Forward + reverse geocoding helpers.
 * Forward uses Open-Meteo (fast, lat/lon by name). Reverse uses Nominatim
 * (OpenStreetMap) since Open-Meteo doesn't support reverse lookups.
 */
export interface GeocodeResult {
  name: string;
  admin?: string;
  country?: string;
  countryCode?: string;
  lat: number;
  lon: number;
  label: string;
}

interface OMResult {
  results?: Array<{
    name: string;
    admin1?: string;
    country?: string;
    country_code?: string;
    latitude: number;
    longitude: number;
  }>;
}

export async function geocode(query: string, count = 8): Promise<GeocodeResult[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const data = (await res.json()) as OMResult;
  return (data.results ?? []).map((r) => ({
    name: r.name,
    admin: r.admin1,
    country: r.country,
    countryCode: r.country_code,
    lat: r.latitude,
    lon: r.longitude,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
  }));
}

interface NominatimResult {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

/**
 * Reverse geocode lat/lon → human-readable place name via Nominatim (OSM).
 * Free, no API key, but they ask for a meaningful User-Agent and ask that we
 * don't hammer it (the result is cached for a day per coord).
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<GeocodeResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", lat.toFixed(5));
  url.searchParams.set("lon", lon.toFixed(5));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "10"); // city/town level
  url.searchParams.set("accept-language", "en");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "VeckansVader/0.1 (https://veckansvader.se)",
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimResult;
  const a = data.address ?? {};
  const name =
    a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? a.state;
  if (!name) return null;
  return {
    name,
    admin: a.state,
    country: a.country,
    countryCode: a.country_code?.toUpperCase(),
    lat,
    lon,
    label: [name, a.state, a.country].filter(Boolean).join(", "),
  };
}
