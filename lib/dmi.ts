import type { Forecast, HourPoint, WeatherCondition } from "./types";
import { aggregateDaily } from "./aggregate";

// ---------------------------------------------------------------------------
// 1) DMI Open Data EDR API (HARMONIE DINI surface, ~3 days)
// ---------------------------------------------------------------------------
const DMI_BASE =
  "https://opendataapi.dmi.dk/v1/forecastedr/collections/harmonie_dini_sf/position";

const DMI_PARAMS = [
  "temperature-2m",
  "total-precipitation",
  "wind-speed-10m",
  "wind-dir-10m",
  "relative-humidity-2m",
  "fraction-of-cloud-cover",
  "pressure-sealevel",
];

interface CovJsonResponse {
  domain: { axes: { t: { values: string[] } } };
  ranges: Record<string, { values: (number | null)[] }>;
}

function cv(r: CovJsonResponse["ranges"], key: string, i: number): number | null {
  const x = r[key]?.values?.[i];
  return x != null && Number.isFinite(x) ? x : null;
}

function deriveCondition(precip: number | null, cloudFraction: number | null): WeatherCondition {
  const p = precip ?? 0;
  const c = cloudFraction ?? 0;
  if (p >= 4) return "rain-heavy";
  if (p >= 1) return "rain";
  if (p >= 0.1) return "rain-light";
  if (c >= 0.85) return "cloudy";
  if (c >= 0.4) return "partly-cloudy";
  return "clear";
}

// ---------------------------------------------------------------------------
// 2) NinJo scraper (dmi.dk internal API, ~10 days)
// ---------------------------------------------------------------------------
const NINJO_URL = "https://www.dmi.dk/NinJo2DmiDk/ninjo2dmidk";

interface NinJoEntry {
  localTimeIso: string;
  temp: number;
  symbol: number;
  precip1: number;
  windDegree: number;
  windSpeed: number;
  humidity: number;
  pressure: number;
}

function ninjoSymbolToCondition(code: number): WeatherCondition {
  if (code === 1 || code === 101) return "clear";
  if (code === 2 || code === 3 || code === 102 || code === 103) return "partly-cloudy";
  if (code === 4) return "cloudy";
  if (code === 45) return "fog";
  if (code === 38 || code === 46 || code === 47) return "rain-light";
  if (code === 60 || code === 80) return "rain";
  if (code === 63 || code === 81) return "rain-heavy";
  if (code === 68 || code === 83) return "sleet";
  if (code === 70 || code === 73 || code === 85) return "snow";
  if (code === 95) return "thunder";
  return "partly-cloudy";
}

/** Tagged HourPoint so we can carry the condition alongside. */
interface TaggedHour {
  hour: HourPoint;
  condition: WeatherCondition;
}

// ---------------------------------------------------------------------------
// Fetch EDR
// ---------------------------------------------------------------------------
async function fetchEdr(lat: number, lon: number): Promise<TaggedHour[]> {
  const url = new URL(DMI_BASE);
  url.searchParams.set("coords", `POINT(${lon} ${lat})`);
  url.searchParams.set("crs", "crs84");
  url.searchParams.set("parameter-name", DMI_PARAMS.join(","));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": "WeatherCompare/0.1" },
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`DMI EDR HTTP ${res.status}`);
  const data = (await res.json()) as CovJsonResponse;

  const times = data.domain.axes.t.values;
  const r = data.ranges;

  const hours: HourPoint[] = times.map((time, i) => ({
    time,
    temperature: ((t) => (t == null ? null : t - 273.15))(cv(r, "temperature-2m", i)),
    precipitation: cv(r, "total-precipitation", i),
    windSpeed: cv(r, "wind-speed-10m", i),
    windDirection: cv(r, "wind-dir-10m", i),
    humidity: cv(r, "relative-humidity-2m", i),
    cloudCover: ((c) => (c == null ? null : c * 100))(cv(r, "fraction-of-cloud-cover", i)),
    pressure: ((p) => (p == null ? null : p / 100))(cv(r, "pressure-sealevel", i)),
  }));

  // Accumulated precipitation → per-hour delta.
  for (let i = hours.length - 1; i > 0; i--) {
    const cur = hours[i].precipitation;
    const prev = hours[i - 1].precipitation;
    if (cur != null && prev != null) {
      hours[i].precipitation = Math.max(0, cur - prev);
    }
  }
  if (hours.length) hours[0].precipitation = hours[0].precipitation ?? 0;

  return hours.map((h) => ({
    hour: h,
    condition: deriveCondition(h.precipitation, h.cloudCover == null ? null : h.cloudCover / 100),
  }));
}

// ---------------------------------------------------------------------------
// Fetch NinJo
// ---------------------------------------------------------------------------
async function fetchNinjo(lat: number, lon: number): Promise<TaggedHour[]> {
  const url = new URL(NINJO_URL);
  url.searchParams.set("cmd", "llj");
  url.searchParams.set("lat", lat.toFixed(4));
  url.searchParams.set("lon", lon.toFixed(4));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": "WeatherCompare/0.1" },
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`DMI NinJo HTTP ${res.status}`);
  const data = (await res.json()) as { timeserie: NinJoEntry[] };

  return (data.timeserie ?? []).map((e) => ({
    hour: {
      time: new Date(e.localTimeIso).toISOString(),
      temperature: e.temp,
      precipitation: e.precip1,
      windSpeed: e.windSpeed,
      windDirection: e.windDegree,
      humidity: e.humidity,
      cloudCover: null,
      pressure: e.pressure,
    },
    condition: ninjoSymbolToCondition(e.symbol),
  }));
}

// ---------------------------------------------------------------------------
// Public: merge EDR (short, high-res) + NinJo (long, scraped) into one Forecast
// ---------------------------------------------------------------------------
export async function fetchDmi(lat: number, lon: number): Promise<Forecast> {
  const [edrRes, ninjoRes] = await Promise.allSettled([
    fetchEdr(lat, lon),
    fetchNinjo(lat, lon),
  ]);

  const edrData = edrRes.status === "fulfilled" ? edrRes.value : [];
  const ninjoData = ninjoRes.status === "fulfilled" ? ninjoRes.value : [];

  if (!edrData.length && !ninjoData.length) {
    throw new Error("Both DMI sources failed");
  }

  // Use EDR for the days it covers; NinJo fills remaining days.
  const edrDates = new Set(edrData.map((t) => t.hour.time.slice(0, 10)));
  const extended = ninjoData.filter((t) => !edrDates.has(t.hour.time.slice(0, 10)));
  const merged = [...edrData, ...extended];

  const hourly = merged.map((t) => t.hour);
  const conditions = merged.map((t) => t.condition);
  const daily = aggregateDaily(hourly, conditions, 8);

  return { provider: "dmi", lat, lon, hourly, daily };
}
