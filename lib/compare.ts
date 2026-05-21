import type {
  ComparedDay,
  CompareResponse,
  DaySummary,
  Forecast,
  ProviderWeights,
  WeatherCondition,
} from "./types";
import { providerWeights } from "./geo";

const CONDITION_RANK: Record<WeatherCondition, number> = {
  clear: 0,
  "partly-cloudy": 1,
  cloudy: 2,
  fog: 3,
  "rain-light": 4,
  rain: 5,
  "rain-heavy": 6,
  sleet: 7,
  snow: 8,
  thunder: 9,
  unknown: 0,
};

/**
 * Weighted blend of N nullable numbers. Missing values are excluded and
 * weights renormalised over the remaining sources.
 */
function blendN(
  values: (number | null)[],
  weights: number[],
): number | null {
  let sum = 0;
  let wSum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) {
      sum += v * weights[i];
      wSum += weights[i];
    }
  }
  if (wSum === 0) return null;
  return sum / wSum;
}

/**
 * Pick the condition from the heaviest available source. On near-ties,
 * pick the worse (higher rank) condition.
 */
function pickConditionN(
  conditions: (WeatherCondition | null)[],
  weights: number[],
): WeatherCondition {
  let best: WeatherCondition = "unknown";
  let bestW = -1;
  for (let i = 0; i < conditions.length; i++) {
    const c = conditions[i];
    if (!c || c === "unknown") continue;
    const w = weights[i];
    if (
      w > bestW + 0.05 ||
      (Math.abs(w - bestW) <= 0.05 &&
        CONDITION_RANK[c] > CONDITION_RANK[best])
    ) {
      best = c;
      bestW = w;
    }
  }
  return best;
}

/**
 * Per-day agreement score in [0,1]. Computes pairwise disagreement across
 * all available sources. 1 = perfect agreement, 0 = strong disagreement.
 */
function agreementScore(sources: (DaySummary | null)[]): number {
  const present = sources.filter((s): s is DaySummary => s != null);
  if (present.length < 2) return 0.5; // single source → unknown confidence

  let totalPenalty = 0;
  let pairs = 0;

  function penalise(va: number | null, vb: number | null, scale: number) {
    if (va == null || vb == null) return;
    totalPenalty += Math.min(1, Math.abs(va - vb) / scale);
  }

  for (let i = 0; i < present.length; i++) {
    for (let j = i + 1; j < present.length; j++) {
      const a = present[i];
      const b = present[j];
      pairs++;
      penalise(a.tempMean, b.tempMean, 6);
      penalise(a.tempMax, b.tempMax, 6);
      penalise(a.tempMin, b.tempMin, 6);
      penalise(a.precipitation, b.precipitation, 10);
      penalise(a.windMean, b.windMean, 6);
      penalise(a.cloudMean, b.cloudMean, 50);
    }
  }

  if (pairs === 0) return 0.5;
  // 6 metrics per pair, each can contribute up to 1.0
  const maxPenalty = pairs * 6;
  return Math.max(0, Math.min(1, 1 - totalPenalty / maxPenalty));
}

function blendDay(
  date: string,
  sources: (DaySummary | null)[],
  weights: number[],
): DaySummary {
  const field = (fn: (d: DaySummary) => number | null) =>
    blendN(
      sources.map((s) => (s ? fn(s) : null)),
      weights,
    );

  return {
    date,
    tempMin: field((d) => d.tempMin),
    tempMax: field((d) => d.tempMax),
    tempMean: field((d) => d.tempMean),
    precipitation: field((d) => d.precipitation),
    windMax: field((d) => d.windMax),
    windMean: field((d) => d.windMean),
    humidityMean: field((d) => d.humidityMean),
    cloudMean: field((d) => d.cloudMean),
    condition: pickConditionN(
      sources.map((s) => s?.condition ?? null),
      weights,
    ),
  };
}

export function compareForecasts(
  lat: number,
  lon: number,
  smhi: Forecast | null,
  dmi: Forecast | null,
  openmeteo: Forecast | null,
  errors: { smhi?: string; dmi?: string; openmeteo?: string } = {},
  label?: string,
): CompareResponse {
  // Compute geographic weights, then zero out providers that returned no data
  // and renormalise so the displayed weights reflect what was actually used.
  const raw = providerWeights({ lat, lon });
  const masked = {
    smhi: smhi ? raw.smhi : 0,
    dmi: dmi ? raw.dmi : 0,
    openmeteo: openmeteo ? raw.openmeteo : 0,
  };
  const total = masked.smhi + masked.dmi + masked.openmeteo;
  const weights = total > 0
    ? {
        smhi: masked.smhi / total,
        dmi: masked.dmi / total,
        openmeteo: masked.openmeteo / total,
      }
    : raw;
  const w = [weights.smhi, weights.dmi, weights.openmeteo];

  // Union of dates from all providers, sorted, capped at 7 days.
  const dates = new Set<string>();
  smhi?.daily.forEach((d) => dates.add(d.date));
  dmi?.daily.forEach((d) => dates.add(d.date));
  openmeteo?.daily.forEach((d) => dates.add(d.date));
  const sorted = [...dates].sort().slice(0, 7);

  const days: ComparedDay[] = sorted.map((date) => {
    const s = smhi?.daily.find((d) => d.date === date) ?? null;
    const dm = dmi?.daily.find((d) => d.date === date) ?? null;
    const om = openmeteo?.daily.find((d) => d.date === date) ?? null;
    return {
      date,
      smhi: s,
      dmi: dm,
      openmeteo: om,
      blend: blendDay(date, [s, dm, om], w),
      weights,
      agreement: agreementScore([s, dm, om]),
    };
  });

  return {
    location: { lat, lon, label },
    weights,
    days,
    smhi,
    dmi,
    openmeteo,
    errors,
  };
}
