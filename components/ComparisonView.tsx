"use client";

import { useState } from "react";
import type {
  CompareResponse,
  ComparedDay,
  DaySummary,
  WeatherCondition,
} from "@/lib/types";
import { WeatherIcon } from "./WeatherIcon";
import { HourlyView } from "./HourlyView";
import { useT } from "./LocaleProvider";

function fmt(n: number | null, digits = 1, suffix = ""): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return `${n.toFixed(digits)}${suffix}`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function dayLabel(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function conditionClass(c: WeatherCondition): string {
  return `cond-${c}`;
}

function AgreementBadge({ value }: { value: number }) {
  const t = useT();
  let tone = "bg-emerald-500";
  let label = t("high_agreement");
  if (value < 0.6) {
    tone = "bg-amber-500";
    label = t("some_disagreement");
  }
  if (value < 0.35) {
    tone = "bg-red-500";
    label = t("low_agreement");
  }
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-white shadow-sm ${tone}`}
        title={`${label}: ${pct(value)}`}
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
        {pct(value)}
      </div>
    </div>
  );
}

function WeightBar({ data }: { data: CompareResponse }) {
  const w = data.weights;
  const segments = [
    { label: "SMHI", value: w.smhi, color: "bg-smhi" },
    { label: "DMI", value: w.dmi, color: "bg-dmi" },
    { label: "Global", value: w.openmeteo, color: "bg-blend" },
  ].filter((s) => s.value > 0.005);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`${s.color} h-full transition-all`}
            style={{ width: `${s.value * 100}%` }}
            title={`${s.label}: ${pct(s.value)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.color}`} />
            <span className="font-semibold">{s.label}</span>
            <span className="text-slate-500">{pct(s.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SourceRow({
  label,
  dot,
  day,
  unavailableText,
}: {
  label: string;
  dot: string;
  day: DaySummary | null;
  unavailableText: string;
}) {
  if (!day) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-white/40 px-3 py-1.5 text-xs text-slate-500 dark:bg-slate-900/40">
        <span className="inline-flex items-center gap-2 font-medium">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {label}
        </span>
        <span className="italic opacity-70">{unavailableText}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/40 px-3 py-1.5 text-xs dark:bg-slate-900/40">
      <span className="inline-flex items-center gap-2 font-medium">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="flex items-center gap-2 tabular-nums">
        <WeatherIcon condition={day.condition} size="text-sm" />
        <span>
          {fmt(day.tempMin, 0, "°")}/{fmt(day.tempMax, 0, "°")}
        </span>
        <span className="text-slate-500">{fmt(day.precipitation, 1, "mm")}</span>
      </span>
    </div>
  );
}

function DayCard({
  day,
  index,
  selected,
  onSelect,
}: {
  day: ComparedDay;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`fade-up flex cursor-pointer flex-col gap-4 rounded-3xl border ${
        selected
          ? "border-indigo-400 ring-2 ring-indigo-300/60"
          : "border-white/40"
      } ${conditionClass(day.blend.condition)} p-5 shadow-lg shadow-slate-200/50 backdrop-blur transition hover:scale-[1.01] dark:border-slate-700/40 dark:shadow-black/30 ${
        selected ? "dark:ring-indigo-500/60" : ""
      }`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            {dayLabel(day.date)}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <WeatherIcon condition={day.blend.condition} size="text-5xl" />
            <div className="leading-none">
              <div className="text-4xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                {fmt(day.blend.tempMax, 0, "°")}
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                {fmt(day.blend.tempMin, 0, "°")} {t("avg_temp").toLowerCase()}{" "}
                {fmt(day.blend.tempMean, 0, "°")}
              </div>
            </div>
          </div>
        </div>
        <AgreementBadge value={day.agreement} />
      </header>

      <div className="grid grid-cols-3 gap-3 rounded-2xl bg-white/40 p-3 text-center text-xs dark:bg-slate-950/30">
        <div>
          <div className="text-slate-500 dark:text-slate-400">{t("precipitation")}</div>
          <div className="mt-1 font-semibold tabular-nums">
            {fmt(day.blend.precipitation, 1)}<span className="text-slate-500"> mm</span>
          </div>
        </div>
        <div>
          <div className="text-slate-500 dark:text-slate-400">{t("wind")}</div>
          <div className="mt-1 font-semibold tabular-nums">
            {fmt(day.blend.windMean, 1)}<span className="text-slate-500"> m/s</span>
          </div>
        </div>
        <div>
          <div className="text-slate-500 dark:text-slate-400">{t("cloud")}</div>
          <div className="mt-1 font-semibold tabular-nums">
            {fmt(day.blend.cloudMean, 0, "%")}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <SourceRow
          label="SMHI"
          dot="bg-smhi"
          day={day.smhi}
          unavailableText={t("unavailable")}
        />
        <SourceRow
          label="DMI"
          dot="bg-dmi"
          day={day.dmi}
          unavailableText={t("unavailable")}
        />
        <SourceRow
          label="Open-Meteo"
          dot="bg-blend"
          day={day.openmeteo}
          unavailableText={t("unavailable")}
        />
      </div>
    </article>
  );
}

export function ComparisonView({ data }: { data: CompareResponse }) {
  const t = useT();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  function toggle(date: string) {
    setSelectedDate((cur) => (cur === date ? null : date));
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 rounded-3xl border border-white/40 bg-white/70 p-5 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/60 dark:shadow-black/30">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-indigo-500" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
          </svg>
          <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
            {data.location.label ??
              `${data.location.lat.toFixed(3)}, ${data.location.lon.toFixed(3)}`}
          </h2>
        </div>
        <WeightBar data={data} />
        {(data.errors.smhi || data.errors.dmi || data.errors.openmeteo) && (
          <div className="flex flex-col gap-1 text-xs">
            {data.errors.smhi && (
              <p className="rounded-lg bg-amber-100/70 px-3 py-1.5 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                SMHI: {data.errors.smhi}
              </p>
            )}
            {data.errors.dmi && (
              <p className="rounded-lg bg-amber-100/70 px-3 py-1.5 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                DMI: {data.errors.dmi}
              </p>
            )}
            {data.errors.openmeteo && (
              <p className="rounded-lg bg-amber-100/70 px-3 py-1.5 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                Open-Meteo: {data.errors.openmeteo}
              </p>
            )}
          </div>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.days.map((day, i) => (
          <DayCard
            key={day.date}
            day={day}
            index={i}
            selected={selectedDate === day.date}
            onSelect={() => toggle(day.date)}
          />
        ))}
      </div>

      {selectedDate && (
        <HourlyView
          data={data}
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </section>
  );
}
