"use client";

import { useEffect } from "react";
import { useTimeOfDay, type TimeOfDayPhase } from "@/lib/timeOfDay";

const PHASES: TimeOfDayPhase[] = ["dawn", "morning", "day", "dusk", "night"];

/**
 * Applies a `tod-<phase>` class to <body> so globals.css can render a
 * background that matches the current time of day. Renders nothing.
 *
 * The phase is recomputed every 5 minutes (via useTimeOfDay) so the
 * background drifts naturally as the day progresses.
 */
export function TimeOfDayBackground() {
  const phase = useTimeOfDay();

  useEffect(() => {
    const body = document.body;
    for (const p of PHASES) body.classList.remove(`tod-${p}`);
    body.classList.add(`tod-${phase}`);
    return () => {
      body.classList.remove(`tod-${phase}`);
    };
  }, [phase]);

  return null;
}
