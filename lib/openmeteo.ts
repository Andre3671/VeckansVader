import type { Forecast, HourPoint, WeatherCondition } from "./types";
import { aggregateDaily } from "./aggregate";

/**
 * Open-Meteo global forecast API.
 * Docs: https://open-meteo.com/en/docs
 * No API key required. Returns 7 days of hourly data.
 * Units: °C, mm, km/h (we convert to m/s), %, hPa, WMO weather codes.
 */
const OM_URL = "https://api.open-meteo.com/v1/forecast";

const HOURLY_PARAMS = [
  "temperature_2m",
  "precipitation",
  "wind_speed_10m",
  "wind_direction_10m",
  "relative_humidity_2m",
  "cloud_cover",
  "surface_pressure",
  "weather_code",
].join(",");

interface OMResponse {
  utc_offset_seconds?: number;
  hourly: {
    time: string[];
    temperature_2m: (number | null)[];
    precipitation: (number | null)[];
    wind_speed_10m: (number | null)[];
    wind_direction_10m: (number | null)[];
    relative_humidity_2m: (number | null)[];
    cloud_cover: (number | null)[];
    surface_pressure: (number | null)[];
    weather_code: (number | null)[];
  };
}

/**
 * WMO weather interpretation codes → our condition.
 * https://open-meteo.com/en/docs#weathervariables
 */
function wmoToCondition(code: number | null): WeatherCondition {
  if (code == null) return "unknown";
  if (code === 0) return "clear";
  if (code <= 3) return "partly-cloudy";
  if (code >= 45 && code <= 48) return "fog";
  if (code >= 51 && code <= 55) return "rain-light";
  if (code >= 56 && code <= 57) return "sleet"; // freezing drizzle
  if (code >= 61 && code <= 63) return "rain";
  if (code === 65 || code === 67) return "rain-heavy";
  if (code === 66) return "sleet"; // freezing rain
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain"; // showers
  if (code === 85 || code === 86) return "snow"; // snow showers
  if (code >= 95) return "thunder";
  return "unknown";
}

export async function fetchOpenMeteo(lat: number, lon: number): Promise<Forecast> {
  const url = new URL(OM_URL);
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set("hourly", HOURLY_PARAMS);
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("forecast_days", "7");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = (await res.json()) as OMResponse;

  const h = data.hourly;
  const hourly: HourPoint[] = h.time.map((time, i) => ({
    // Open-Meteo returns times like "2026-05-13T00:00" — append Z for UTC.
    time: time.endsWith("Z") ? time : time + "Z",
    temperature: h.temperature_2m[i],
    precipitation: h.precipitation[i],
    // Open-Meteo wind is km/h → convert to m/s
    windSpeed: h.wind_speed_10m[i] != null ? h.wind_speed_10m[i]! / 3.6 : null,
    windDirection: h.wind_direction_10m[i],
    humidity: h.relative_humidity_2m[i],
    cloudCover: h.cloud_cover[i],
    pressure: h.surface_pressure[i],
  }));

  const hourlyConditions = h.weather_code.map(wmoToCondition);
  const daily = aggregateDaily(hourly, hourlyConditions, 8);

  return { provider: "openmeteo", lat, lon, hourly, daily };
}
