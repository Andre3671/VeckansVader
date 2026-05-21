export type Provider = "smhi" | "dmi" | "openmeteo";

export interface ProviderWeights {
  smhi: number;
  dmi: number;
  openmeteo: number;
}

export interface HourPoint {
  /** ISO timestamp, e.g. "2026-05-13T15:00:00Z" */
  time: string;
  /** Air temperature, °C */
  temperature: number | null;
  /** Precipitation, mm (per hour) */
  precipitation: number | null;
  /** Wind speed, m/s (at ~10 m) */
  windSpeed: number | null;
  /** Wind direction, degrees (0–360, meteorological) */
  windDirection: number | null;
  /** Relative humidity, % */
  humidity: number | null;
  /** Cloud cover, % */
  cloudCover: number | null;
  /** Mean sea-level pressure, hPa */
  pressure: number | null;
}

export interface DaySummary {
  /** YYYY-MM-DD (local UTC date) */
  date: string;
  tempMin: number | null;
  tempMax: number | null;
  tempMean: number | null;
  precipitation: number | null;
  windMax: number | null;
  windMean: number | null;
  humidityMean: number | null;
  cloudMean: number | null;
  /** Most common condition icon/label for the day */
  condition: WeatherCondition;
}

export type WeatherCondition =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "fog"
  | "rain-light"
  | "rain"
  | "rain-heavy"
  | "snow"
  | "sleet"
  | "thunder"
  | "unknown";

export interface Forecast {
  provider: Provider;
  /** Location actually used by provider (may differ slightly from request) */
  lat: number;
  lon: number;
  /** Reference run time (ISO) when available */
  referenceTime?: string;
  hourly: HourPoint[];
  daily: DaySummary[];
}

export interface ComparedDay {
  date: string;
  smhi: DaySummary | null;
  dmi: DaySummary | null;
  openmeteo: DaySummary | null;
  /** Blended estimate */
  blend: DaySummary;
  /** Source weights actually used, sum=1 */
  weights: ProviderWeights;
  /** 0–1: how much the sources agree (1 = perfect) */
  agreement: number;
}

export interface CompareResponse {
  location: { lat: number; lon: number; label?: string };
  weights: ProviderWeights;
  days: ComparedDay[];
  smhi: Forecast | null;
  dmi: Forecast | null;
  openmeteo: Forecast | null;
  errors: { smhi?: string; dmi?: string; openmeteo?: string };
}
