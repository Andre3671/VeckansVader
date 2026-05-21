"use client";

import Link from "next/link";
import { useT } from "./LocaleProvider";
import { nearestCity } from "@/lib/cities";

/**
 * If the user's resolved coordinates are within ~50 km of a curated city,
 * render a banner that links to the SEO-optimised city landing page.
 *
 * Rendered above the forecast on the homepage only. On a /vader/<city>
 * route the hint is skipped because the user is already on the relevant
 * landing page.
 *
 * Hidden in the native app (no point sending users to a web URL when
 * they're already in the app).
 */
export function NearestCityHint({
  lat,
  lon,
  hidden = false,
}: {
  lat: number | null;
  lon: number | null;
  /** Set to true on city pages / inside the native app to skip rendering. */
  hidden?: boolean;
}) {
  const t = useT();
  if (hidden || lat == null || lon == null) return null;
  const hit = nearestCity(lat, lon);
  // Only suggest if the user is close enough that the city's forecast is
  // actually representative. Beyond 50 km it's a stretch.
  if (!hit || hit.km > 50) return null;

  return (
    <Link
      href={`/vader/${hit.city.slug}`}
      className="group fade-up mx-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl border border-indigo-200/60 bg-white/70 px-4 py-2.5 text-sm text-indigo-700 shadow-sm backdrop-blur transition hover:bg-white dark:border-indigo-500/40 dark:bg-slate-900/60 dark:text-indigo-300 dark:hover:bg-slate-900"
    >
      <span className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
        </svg>
        <span className="font-medium">
          {t("show_city_weather").replace("{city}", hit.city.name)}
        </span>
      </span>
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
