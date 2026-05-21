import type { DaySummary, HourPoint, WeatherCondition } from "./types";

function mean(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function sum(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0);
}

function dominant<T extends string>(xs: T[], fallback: T): T {
  if (!xs.length) return fallback;
  const counts = new Map<T, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best: T = fallback;
  let bestN = -1;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

/**
 * Group hourly points into per-day summaries. Uses the date portion of the
 * ISO timestamp in UTC; this matches how SMHI/DMI publish hourly data and is
 * good enough for a multi-day overview.
 *
 * `conditions` runs in parallel with `hours` (same length and index).
 */
export function aggregateDaily(
  hours: HourPoint[],
  conditions: WeatherCondition[],
  maxDays = 7,
): DaySummary[] {
  const byDate = new Map<string, { hours: HourPoint[]; conds: WeatherCondition[] }>();
  for (let i = 0; i < hours.length; i++) {
    const h = hours[i];
    const date = h.time.slice(0, 10);
    let bucket = byDate.get(date);
    if (!bucket) {
      bucket = { hours: [], conds: [] };
      byDate.set(date, bucket);
    }
    bucket.hours.push(h);
    bucket.conds.push(conditions[i] ?? "unknown");
  }

  const dates = [...byDate.keys()].sort().slice(0, maxDays);
  return dates.map((date) => {
    const { hours: list, conds } = byDate.get(date)!;
    const temps = list.map((h) => h.temperature ?? NaN);
    const winds = list.map((h) => h.windSpeed ?? NaN);
    const cloud = list.map((h) => h.cloudCover ?? NaN);
    const hum = list.map((h) => h.humidity ?? NaN);
    const precip = list.map((h) => h.precipitation ?? NaN);

    return {
      date,
      tempMin: temps.some((t) => Number.isFinite(t))
        ? Math.min(...temps.filter((t) => Number.isFinite(t)))
        : null,
      tempMax: temps.some((t) => Number.isFinite(t))
        ? Math.max(...temps.filter((t) => Number.isFinite(t)))
        : null,
      tempMean: mean(temps),
      precipitation: sum(precip),
      windMax: winds.some((t) => Number.isFinite(t))
        ? Math.max(...winds.filter((t) => Number.isFinite(t)))
        : null,
      windMean: mean(winds),
      humidityMean: mean(hum),
      cloudMean: mean(cloud),
      condition: dominant<WeatherCondition>(conds, "unknown"),
    };
  });
}
