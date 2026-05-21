"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "./LocaleProvider";
import { apiUrl } from "@/lib/api";
import { getCurrentPosition } from "@/lib/platform";

export interface PickedLocation {
  lat: number;
  lon: number;
  label?: string;
}

interface GeoHit {
  name: string;
  admin?: string;
  country?: string;
  countryCode?: string;
  lat: number;
  lon: number;
  label: string;
}

export function LocationPicker({
  onPick,
  loading,
  value,
}: {
  onPick: (loc: PickedLocation) => void;
  loading?: boolean;
  /** When set, drives the input value (e.g. resolved place name after geolocation). */
  value?: string;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [open, setOpen] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Suppress the autocomplete fetch when the value was set externally
  // (e.g. via geolocation reverse-geocode), since we don't want to immediately
  // show a dropdown of "Stockholm, …"-style hits over the just-resolved city.
  const skipNextFetch = useRef(false);

  // Mirror externally-controlled value into the local input state.
  useEffect(() => {
    if (value != null && value !== q) {
      skipNextFetch.current = true;
      setQ(value);
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/geocode?q=${encodeURIComponent(q)}`), {
          signal: controller.signal,
        });
        const data = await res.json();
        setHits(data.results ?? []);
        setOpen(true);
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
        setHits([]);
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      controller.abort();
    };
  }, [q]);

  async function useMyLocation() {
    setGeoError(null);
    try {
      const { lat, lon } = await getCurrentPosition();
      onPick({ lat, lon, label: t("my_location") });
    } catch (e: unknown) {
      setGeoError(e instanceof Error ? e.message : String(e));
    }
  }

  function selectHit(h: GeoHit) {
    skipNextFetch.current = true;
    setQ(h.label);
    setOpen(false);
    onPick({ lat: h.lat, lon: h.lon, label: h.label });
  }

  return (
    <div className="w-full max-w-xl">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder={t("search_placeholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => hits.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="w-full rounded-2xl border border-white/40 bg-white/80 py-3.5 pl-11 pr-4 text-sm shadow-lg shadow-slate-200/50 backdrop-blur transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-100 dark:shadow-black/20 dark:placeholder:text-slate-500"
          />
          {open && hits.length > 0 && (
            <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
              {hits.map((h, i) => (
                <li
                  key={`${h.lat},${h.lon},${i}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectHit(h);
                  }}
                  className="cursor-pointer border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-indigo-50 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <div className="font-medium">{h.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {[h.admin, h.country].filter(Boolean).join(", ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/40 bg-white/80 px-4 py-3.5 text-sm font-medium shadow-lg shadow-slate-200/50 backdrop-blur transition hover:bg-white disabled:opacity-50 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-100 dark:shadow-black/20 dark:hover:bg-slate-900"
          title={t("my_location")}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
          </svg>
          <span className="hidden sm:inline">{t("my_location")}</span>
        </button>
      </div>
      {geoError && (
        <p className="mt-2 text-sm text-red-500">
          {t("geolocation_prefix")} {geoError}
        </p>
      )}
    </div>
  );
}
