"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import { useT } from "./LocaleProvider";

/**
 * Footer pill showing the all-time unique visitor count.
 *
 * Calls /api/stats/visitors on mount — that endpoint both registers the
 * caller and returns the running tally, so a single round-trip both bumps
 * and reads the counter. Idempotent (same IP doesn't double-count). Renders
 * nothing on first paint to avoid layout shift, then fades in when the
 * number arrives.
 */
export function VisitorBadge() {
  const t = useT();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/stats/visitors"))
      .then((r) => r.json())
      .then((d: { total?: number }) => {
        if (!cancelled && typeof d.total === "number") {
          setCount(d.total);
        }
      })
      .catch(() => {
        // best-effort vanity stat — don't show errors
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (count == null) return null;

  return (
    <div
      className="fade-up inline-flex items-center gap-1.5 rounded-full border border-slate-300/60 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-300"
      title={t("visitors_total")}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
      </span>
      <span className="tabular-nums">
        {count.toLocaleString()} {t("visitors_total")}
      </span>
    </div>
  );
}
