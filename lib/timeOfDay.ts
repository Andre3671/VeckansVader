"use client";

import { useEffect, useState } from "react";

export type TimeOfDayPhase =
  | "dawn"
  | "morning"
  | "day"
  | "dusk"
  | "night";

/**
 * Map an hour (0–23) to a perceptual phase of day. Approximate boundaries —
 * we don't bother with location-based sunrise/sunset because the user just
 * wants a vibe shift, not astronomical accuracy.
 */
export function phaseForHour(hour: number): TimeOfDayPhase {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}

/**
 * Returns the current time-of-day phase, recomputed every 5 minutes so the
 * background drifts naturally without a page reload. Returns "day" during
 * SSR / before the first client tick to avoid hydration mismatches.
 */
export function useTimeOfDay(): TimeOfDayPhase {
  const [phase, setPhase] = useState<TimeOfDayPhase>("day");
  useEffect(() => {
    function update() {
      setPhase(phaseForHour(new Date().getHours()));
    }
    update();
    const id = setInterval(update, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return phase;
}
