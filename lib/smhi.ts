import type { Forecast, HourPoint, WeatherCondition } from "./types";
import { aggregateDaily } from "./aggregate";

/**
 * SMHI has two forecast sources:
 *
 * 1. **Open Data SNOW1g** — high-resolution model (HARMONIE-like) for the
 *    Nordics + Baltic states. Replaced the deprecated PMP3g API in March 2026.
 *    Returns 404 for locations outside coverage.
 *
 * 2. **Weather page backend (ECMWF-based)** — what smhi.se uses for global
 *    locations. Looks up by geonameid; we resolve coords to geonameid first.
 *    Used as a fallback when SNOW1g returns 404.
 *
 * Both are unauthenticated.
 */

const SMHI_SNOW1G_URL =
  "https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/{lon}/lat/{lat}/data.json";

const SMHI_WEATHERPAGE_BASE = "https://wpt-a.smhi.se/backend-weatherpage";

function n(v: number | undefined | null): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

/**
 * Map SMHI Wsymb2 / symbol_code to our common condition.
 */
function symbolToCondition(code: number | null): WeatherCondition {
  if (code == null) return "unknown";
  if (code === 1) return "clear";
  if (code === 2 || code === 3) return "partly-cloudy";
  if (code === 4 || code === 5 || code === 6) return "cloudy";
  if (code === 7) return "fog";
  if (code === 8 || code === 18) return "rain-light";
  if (code === 9 || code === 19) return "rain";
  if (code === 10 || code === 20) return "rain-heavy";
  if (code === 11 || code === 21) return "thunder";
  if (code === 12 || code === 13 || code === 14 || code === 22 || code === 23 || code === 24)
    return "sleet";
  if (code === 15 || code === 16 || code === 17 || code === 25 || code === 26 || code === 27)
    return "snow";
  return "unknown";
}

// ---------------------------------------------------------------------------
// 1) SNOW1g (Nordic)
// ---------------------------------------------------------------------------
interface Snow1gData {
  air_temperature?: number;
  wind_speed?: number;
  wind_from_direction?: number;
  relative_humidity?: number;
  cloud_area_fraction?: number; // oktas 0–8
  air_pressure_at_mean_sea_level?: number;
  precipitation_amount_mean?: number;
  symbol_code?: number;
}

interface Snow1gResponse {
  createdTime?: string;
  referenceTime?: string;
  timeSeries: { time: string; data: Snow1gData }[];
}

async function fetchSnow1g(lat: number, lon: number): Promise<Forecast | null> {
  const url = SMHI_SNOW1G_URL.replace("{lon}", lon.toFixed(4)).replace("{lat}", lat.toFixed(4));

  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "WeatherCompare/0.1" },
    next: { revalidate: 1800 },
  });
  // 404 = out of coverage → caller falls back to ECMWF.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`SMHI HTTP ${res.status}`);
  const data = (await res.json()) as Snow1gResponse;

  const hourly: HourPoint[] = data.timeSeries.map((t) => {
    const d = t.data;
    return {
      time: t.time,
      temperature: n(d.air_temperature),
      precipitation: n(d.precipitation_amount_mean),
      windSpeed: n(d.wind_speed),
      windDirection: n(d.wind_from_direction),
      humidity: n(d.relative_humidity),
      cloudCover: d.cloud_area_fraction != null ? (d.cloud_area_fraction / 8) * 100 : null,
      pressure: n(d.air_pressure_at_mean_sea_level),
    };
  });

  const conditions = data.timeSeries.map((t) => symbolToCondition(n(t.data.symbol_code)));
  const daily = aggregateDaily(hourly, conditions, 8);

  return {
    provider: "smhi",
    lat,
    lon,
    referenceTime: data.referenceTime ?? data.createdTime,
    hourly,
    daily,
  };
}

// ---------------------------------------------------------------------------
// 2) Weather page backend (ECMWF, global)
// ---------------------------------------------------------------------------
interface WpHour {
  validTime: string;
  t?: number;       // temp °C
  tp?: number;      // total precipitation mm
  ws?: number;      // wind speed m/s
  wd?: number;      // wind direction degrees
  r?: number;       // relative humidity %
  msl?: number;     // mean sea level pressure hPa
  Wsymb2?: number;  // weather symbol
}

interface WpDay {
  data: WpHour[];
}

interface WpResponse {
  place?: { lat: number; lon: number };
  forecast10d?: {
    approvedTime?: string;
    referenceTime?: string;
    days: WpDay[];
  };
}

async function fetchGeonameId(lat: number, lon: number): Promise<number | null> {
  const url = `${SMHI_WEATHERPAGE_BASE}/geo/search/lat/${lat.toFixed(4)}/lon/${lon.toFixed(4)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "WeatherCompare/0.1" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { geonameid?: number }[];
  return data[0]?.geonameid ?? null;
}

async function fetchEcmwfByGeonameId(
  lat: number,
  lon: number,
  geonameid: number,
): Promise<Forecast> {
  const url = `${SMHI_WEATHERPAGE_BASE}/forecast/v2025.4/${geonameid}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "WeatherCompare/0.1" },
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`SMHI ECMWF HTTP ${res.status}`);
  const data = (await res.json()) as WpResponse;
  if (!data.forecast10d?.days?.length) {
    throw new Error("SMHI ECMWF: empty forecast");
  }

  const hours: WpHour[] = data.forecast10d.days.flatMap((d) => d.data ?? []);

  const hourly: HourPoint[] = hours.map((h) => ({
    time: h.validTime,
    temperature: n(h.t),
    precipitation: n(h.tp),
    windSpeed: n(h.ws),
    windDirection: n(h.wd),
    humidity: n(h.r),
    cloudCover: null, // not provided by ECMWF endpoint
    pressure: n(h.msl),
  }));

  const conditions = hours.map((h) => symbolToCondition(n(h.Wsymb2)));
  const daily = aggregateDaily(hourly, conditions, 8);

  return {
    provider: "smhi",
    lat,
    lon,
    referenceTime: data.forecast10d.referenceTime ?? data.forecast10d.approvedTime,
    hourly,
    daily,
  };
}

// ---------------------------------------------------------------------------
// Public: try Nordic high-res first, fall back to global ECMWF.
// ---------------------------------------------------------------------------
export async function fetchSmhi(lat: number, lon: number): Promise<Forecast | null> {
  const snow = await fetchSnow1g(lat, lon);
  if (snow) return snow;

  // Out of SNOW1g coverage — try the ECMWF-based weather-page endpoint.
  const geonameid = await fetchGeonameId(lat, lon);
  if (geonameid == null) return null;
  try {
    return await fetchEcmwfByGeonameId(lat, lon, geonameid);
  } catch {
    return null;
  }
}
