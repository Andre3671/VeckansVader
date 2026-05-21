"use client";

import { useEffect, useMemo, useRef } from "react";
import type {
  CompareResponse,
  HourPoint,
  WeatherCondition,
} from "@/lib/types";
import { WeatherIcon } from "./WeatherIcon";
import { useT } from "./LocaleProvider";

interface BlendedHour {
  time: string;
  temperature: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  cloudCover: number | null;
  condition: WeatherCondition;
}

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

function deriveCondition(
  precip: number | null,
  cloudPct: number | null,
): WeatherCondition {
  const p = precip ?? 0;
  const c = (cloudPct ?? 0) / 100;
  if (p >= 4) return "rain-heavy";
  if (p >= 1) return "rain";
  if (p >= 0.1) return "rain-light";
  if (c >= 0.85) return "cloudy";
  if (c >= 0.4) return "partly-cloudy";
  return "clear";
}

/**
 * Blend the three providers' hourly arrays into one 24-row series for the
 * given date. Aligns by UTC hour key (entries from different sources may
 * use slightly different ISO timestamp formats).
 */
function blendHourly(data: CompareResponse, date: string): BlendedHour[] {
  const sources = [
    { hourly: data.smhi?.hourly ?? [], w: data.weights.smhi },
    { hourly: data.dmi?.hourly ?? [], w: data.weights.dmi },
    { hourly: data.openmeteo?.hourly ?? [], w: data.weights.openmeteo },
  ];

  const buckets = new Map<
    string,
    { hours: HourPoint[]; conditions: WeatherCondition[]; weights: number[] }
  >();

  for (const s of sources) {
    for (const h of s.hourly) {
      if (!h.time.startsWith(date)) continue;
      const key = h.time.slice(0, 13);
      let b = buckets.get(key);
      if (!b) {
        b = { hours: [], conditions: [], weights: [] };
        buckets.set(key, b);
      }
      b.hours.push(h);
      b.weights.push(s.w);
      b.conditions.push(deriveCondition(h.precipitation, h.cloudCover));
    }
  }

  function blendN(values: (number | null)[], weights: number[]): number | null {
    let sum = 0;
    let wSum = 0;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v != null && Number.isFinite(v)) {
        sum += v * weights[i];
        wSum += weights[i];
      }
    }
    return wSum === 0 ? null : sum / wSum;
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, b]) => {
      const condition = b.conditions.reduce<WeatherCondition>(
        (worst, c) =>
          CONDITION_RANK[c] > CONDITION_RANK[worst] ? c : worst,
        "unknown",
      );
      return {
        time: key + ":00:00Z",
        temperature: blendN(b.hours.map((h) => h.temperature), b.weights),
        precipitation: blendN(b.hours.map((h) => h.precipitation), b.weights),
        windSpeed: blendN(b.hours.map((h) => h.windSpeed), b.weights),
        cloudCover: blendN(b.hours.map((h) => h.cloudCover), b.weights),
        condition,
      };
    });
}

function conditionClass(c: WeatherCondition): string {
  return `cond-${c}`;
}

function fmt(n: number | null, digits = 0, suffix = ""): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return `${n.toFixed(digits)}${suffix}`;
}

function hourLabel(time: string): string {
  return time.slice(11, 13);
}

/**
 * SVG line chart spanning the hours horizontally. Positioned absolutely
 * so it sits on top of the row of hour cards, giving an at-a-glance
 * temperature trend that aligns with each card column.
 */
function TempChart({
  hours,
  cardWidth,
  height = 56,
}: {
  hours: BlendedHour[];
  cardWidth: number;
  height?: number;
}) {
  const path = useMemo(() => {
    const temps = hours.map((h) => h.temperature);
    const valid = temps.filter((t): t is number => t != null);
    if (valid.length < 2) return { d: "", area: "", labels: [] as { x: number; y: number; t: number }[] };

    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = Math.max(1, max - min);
    const pad = 8; // vertical padding inside the chart box

    const points = hours.map((h, i) => {
      const x = i * cardWidth + cardWidth / 2;
      const t = h.temperature;
      if (t == null) return null;
      const y = pad + (1 - (t - min) / range) * (height - pad * 2);
      return { x, y, t };
    });

    // Build a smooth-ish path using simple quadratic curves between points.
    let d = "";
    let area = "";
    let prev: { x: number; y: number } | null = null;
    for (const p of points) {
      if (!p) continue;
      if (!prev) {
        d += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        area += `M ${p.x.toFixed(1)} ${height} L ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      } else {
        const cx = (prev.x + p.x) / 2;
        d += `Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${cx.toFixed(1)} ${((prev.y + p.y) / 2).toFixed(1)} T ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
        area += `L ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      }
      prev = p;
    }
    if (prev) area += `L ${prev.x.toFixed(1)} ${height} Z`;

    // Pick min/max for labelling on the chart itself.
    const minIdx = temps.indexOf(min);
    const maxIdx = temps.indexOf(max);
    const labels = [minIdx, maxIdx]
      .filter((i, idx, arr) => i !== -1 && arr.indexOf(i) === idx)
      .map((i) => points[i])
      .filter((p): p is { x: number; y: number; t: number } => p !== null);

    return { d, area, labels };
  }, [hours, cardWidth, height]);

  const width = hours.length * cardWidth;
  if (!path.d) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-x-0 top-0 z-0"
      aria-hidden
    >
      <defs>
        <linearGradient id="temp-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>
        <linearGradient id="temp-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill="url(#temp-fill)" />
      <path
        d={path.d}
        fill="none"
        stroke="url(#temp-line)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {path.labels.map((l, i) => (
        <g key={i}>
          <circle cx={l.x} cy={l.y} r={3} fill="#a855f7" />
          <text
            x={l.x}
            y={Math.max(10, l.y - 6)}
            textAnchor="middle"
            className="fill-slate-700 text-[10px] font-bold dark:fill-slate-200"
          >
            {l.t.toFixed(0)}°
          </text>
        </g>
      ))}
    </svg>
  );
}

const CARD_WIDTH = 64; // px, must match the card min-width below

export function HourlyView({
  data,
  date,
  onClose,
}: {
  data: CompareResponse;
  date: string;
  onClose: () => void;
}) {
  const t = useT();
  const hours = blendHourly(data, date);
  const ref = useRef<HTMLDivElement>(null);

  // Smooth-scroll the inline view into the viewport when it opens or when
  // the user switches to a different day while it's open.
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [date]);

  const dateLabel = new Date(date + "T12:00:00Z").toLocaleDateString(
    undefined,
    { weekday: "long", month: "long", day: "numeric" },
  );

  return (
    <section
      ref={ref}
      className="fade-up flex flex-col gap-4 rounded-3xl border border-white/40 bg-white/70 p-5 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/60 dark:shadow-black/30"
      aria-label={`${t("hourly_label")} — ${dateLabel}`}
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
            {t("hourly_label")}
          </div>
          <h3 className="text-lg font-bold tracking-tight sm:text-xl">
            {dateLabel}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="rounded-full p-2 text-slate-500 transition hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800/60"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {hours.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          {t("no_hourly_data")}
        </p>
      ) : (
        <div className="relative -mx-5 overflow-x-auto px-5 pb-2">
          <div
            className="relative"
            style={{ width: `${hours.length * CARD_WIDTH}px`, minWidth: "100%" }}
          >
            {/* Temperature chart overlay sitting above the cards */}
            <TempChart hours={hours} cardWidth={CARD_WIDTH} />

            {/* Row of hour cards */}
            <div className="flex snap-x snap-mandatory pt-16">
              {hours.map((h) => {
                const precip = h.precipitation ?? 0;
                // Visualise precipitation amount as a vertical bar (0–10mm range)
                const precipPct = Math.min(100, (precip / 10) * 100);
                return (
                  <div
                    key={h.time}
                    style={{ width: `${CARD_WIDTH}px` }}
                    className={`${conditionClass(h.condition)} flex shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl border border-white/30 px-1 py-3 text-center text-sm shadow-sm dark:border-slate-700/30`}
                  >
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      {hourLabel(h.time)}
                    </span>
                    <WeatherIcon condition={h.condition} size="text-xl" />
                    <span className="text-base font-bold tabular-nums">
                      {fmt(h.temperature, 0, "°")}
                    </span>
                    {/* Precipitation indicator: tiny vertical bar */}
                    <div className="flex h-6 flex-col items-center justify-end">
                      {precip > 0 ? (
                        <>
                          <div className="w-1.5 rounded-full bg-blue-500/60 dark:bg-blue-400/70" style={{ height: `${Math.max(4, precipPct / 4)}px` }} />
                          <span className="mt-0.5 text-[9px] text-blue-600 dark:text-blue-400 tabular-nums">
                            {precip.toFixed(precip < 1 ? 1 : 0)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[9px] text-slate-400">–</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 tabular-nums">
                      {fmt(h.windSpeed, 0)} m/s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hint that the row is scrollable (mobile) */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/70 to-transparent dark:from-slate-900/60" />
        </div>
      )}
    </section>
  );
}
