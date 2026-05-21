"use client";

import { useEffect, useRef, useState } from "react";
import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";
import { ComparisonView } from "@/components/ComparisonView";
import { Logo } from "@/components/Logo";
import { VisitorBadge } from "@/components/VisitorBadge";
import { useT } from "@/components/LocaleProvider";
import { useIsNative } from "@/components/useIsNative";
import { apiUrl } from "@/lib/api";
import { getCurrentPosition } from "@/lib/platform";
import { refreshScheduledNotifications } from "@/lib/notifications";
import { saveLocationForWidget } from "@/lib/widget-store";
import { SUPPORT_URL } from "@/lib/links";
import { findCityByName, nearestCity } from "@/lib/cities";
import type { CompareResponse } from "@/lib/types";

/**
 * The interactive shell shared by the homepage and per-city SSR pages.
 *
 * `initialData` + `initialLocation` come from a server component (city page)
 * so the first HTML byte already contains rendered weather — good for SEO
 * and for users on slow networks. The homepage passes neither.
 */
export function WeatherPage({
  initialData,
  initialLocation,
  hideAutoLocate = false,
}: {
  initialData?: CompareResponse;
  initialLocation?: PickedLocation;
  /** Skip auto-geolocate (city pages already know where they are). */
  hideAutoLocate?: boolean;
} = {}) {
  const t = useT();
  const isNative = useIsNative();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompareResponse | null>(initialData ?? null);
  const [searchValue, setSearchValue] = useState<string | undefined>(
    initialLocation?.label,
  );
  const [citySuggestion, setCitySuggestion] = useState<
    { slug: string; name: string } | null
  >(null);
  const autoTried = useRef(false);

  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    if (hideAutoLocate) return;
    getCurrentPosition()
      .then(({ lat, lon }) => resolveAndLoad(lat, lon))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideAutoLocate]);

  async function resolveAndLoad(lat: number, lon: number) {
    const forecastPromise = load({ lat, lon, label: t("my_location") });

    // Suggest a curated city page if one exists near these coords. Done
    // BEFORE the reverse-geocode fetch so the banner appears immediately
    // even if Nominatim is slow. Distance-based + ≤50 km so the suggestion
    // is always meteorologically relevant.
    if (!hideAutoLocate) {
      const hit = nearestCity(lat, lon);
      if (hit && hit.km <= 50) {
        setCitySuggestion({ slug: hit.city.slug, name: hit.city.name });
      }
    }

    try {
      const res = await fetch(apiUrl(`/api/geocode?lat=${lat}&lon=${lon}`));
      const body = await res.json();
      if (body?.result?.label) {
        setSearchValue(body.result.label);
        // If the reverse-geocoded name is itself a curated city, prefer it
        // over the distance-based guess (handles cases where the user is
        // genuinely IN city X but the haversine closest is a neighbouring
        // anchor point).
        const exact = findCityByName(body.result.name ?? "");
        if (exact && !hideAutoLocate) {
          setCitySuggestion({ slug: exact.slug, name: exact.name });
        }
      }
    } catch {}
    await forecastPromise;
  }

  async function load(loc: PickedLocation) {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({
        lat: String(loc.lat),
        lon: String(loc.lon),
      });
      if (loc.label) params.set("label", loc.label);
      const res = await fetch(apiUrl(`/api/forecast?${params.toString()}`));
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body);
      refreshScheduledNotifications(loc.lat, loc.lon, loc.label ?? "").catch(() => {});
      saveLocationForWidget({ lat: loc.lat, lon: loc.lon, label: loc.label }).catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handlePick(loc: PickedLocation) {
    const isMyLocation = loc.label === t("my_location");
    if (isMyLocation) {
      resolveAndLoad(loc.lat, loc.lon);
    } else {
      if (loc.label) setSearchValue(loc.label);
      load(loc);
    }
  }

  return (
    <main className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12">
      <a
        href={SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("support_project")}
        title={t("support_project")}
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 1rem)",
          right: "calc(env(safe-area-inset-right, 0px) + 1rem)",
        }}
        className="fixed z-30 flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/60 bg-amber-300 text-slate-900 shadow-lg shadow-amber-200/40 transition hover:scale-105 hover:bg-amber-200 active:scale-95 sm:hidden dark:border-amber-400/40 dark:bg-amber-400 dark:hover:bg-amber-300"
      >
        <span className="text-xl" aria-hidden>☕</span>
      </a>

      <header className="flex items-center gap-4 sm:gap-5">
        <a href="/" aria-label="Veckans Väder">
          <Logo className="h-14 w-14 shrink-0 rounded-2xl shadow-lg shadow-indigo-500/30 sm:h-16 sm:w-16" />
        </a>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="bg-gradient-to-br from-indigo-600 via-violet-600 to-rose-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
            {t("title")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            {t("tagline")}
          </p>
        </div>
      </header>

      <div className="flex flex-col items-center gap-3">
        <LocationPicker onPick={handlePick} loading={loading} value={searchValue} />
        {citySuggestion && !isNative && (
          <a
            href={`/vader/${citySuggestion.slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-300/60 bg-indigo-50/80 px-4 py-1.5 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-100 dark:border-indigo-400/40 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
            </svg>
            {t("show_city_weather").replace("{city}", citySuggestion.name)} →
          </a>
        )}
      </div>

      {loading && (
        <div className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-2xl border border-slate-200/60 bg-white/70 px-6 py-5 text-sm text-slate-600 shadow-sm backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300">
          <svg className="h-5 w-5 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          {t("loading")}
        </div>
      )}

      {error && (
        <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50/80 px-5 py-4 text-sm text-red-700 backdrop-blur dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {data && <ComparisonView data={data} />}

      {!isNative && (
        <footer className="mt-12 flex flex-col items-center gap-6 rounded-3xl border border-white/40 bg-white/50 px-6 py-8 text-sm text-slate-600 backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/40 dark:text-slate-300">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white hover:shadow dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
              href="/vader"
            >
              {t("all_cities")}
            </a>
            <a
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white hover:shadow dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
              href="/api-docs"
            >
              {t("api_docs")}
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-amber-200 hover:shadow dark:bg-amber-400 dark:hover:bg-amber-300"
            >
              <span className="text-base" aria-hidden>☕</span>
              {t("support_project")}
            </a>
          </div>

          <p className="max-w-md text-center text-xs italic opacity-75">
            {t("support_tagline")}
          </p>

          <div className="flex w-full items-center gap-3">
            <span className="h-px flex-1 bg-slate-300/60 dark:bg-slate-700/40" />
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              {t("footer_data")}
            </span>
            <span className="h-px flex-1 bg-slate-300/60 dark:bg-slate-700/40" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
            <a className="hover:underline" href="https://opendata.smhi.se">SMHI</a>
            <a className="hover:underline" href="https://www.dmi.dk/friedata">DMI Open Data</a>
            <a className="hover:underline" href="https://open-meteo.com">Open-Meteo</a>
          </div>

          <p className="max-w-xl text-center text-[11px] opacity-60">
            {t("footer_disclaimer")}
          </p>

          <VisitorBadge />
        </footer>
      )}
    </main>
  );
}
