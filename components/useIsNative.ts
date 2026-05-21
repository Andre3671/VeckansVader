"use client";

import { useEffect, useState } from "react";
import { isNativeSync } from "@/lib/platform";

/**
 * React hook returning `true` when running inside the Capacitor shell.
 *
 * Always returns `false` during SSR / first client render so hydration
 * matches — then flips to the real value in an effect.
 */
export function useIsNative(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(isNativeSync());
  }, []);
  return native;
}
