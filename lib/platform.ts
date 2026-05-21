/**
 * Platform-aware helpers that prefer Capacitor's native APIs on Android/iOS,
 * falling back to browser APIs on the web.
 *
 * We import Capacitor lazily so the web build doesn't pull in native code
 * unnecessarily. `getPlatform()` returns "web" in a regular browser, "android"
 * or "ios" inside the Capacitor shell.
 */

export type Coords = { lat: number; lon: number };

let cachedIsNative: boolean | null = null;

async function isNative(): Promise<boolean> {
  if (cachedIsNative != null) return cachedIsNative;
  try {
    const { Capacitor } = await import("@capacitor/core");
    cachedIsNative = Capacitor.isNativePlatform();
  } catch {
    cachedIsNative = false;
  }
  return cachedIsNative;
}

/**
 * Synchronous platform check for use in render. Returns true only after the
 * Capacitor bridge has been detected via the global object Capacitor injects
 * into the window. Safe to call during SSR (returns false).
 */
export function isNativeSync(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as { Capacitor?: { isNativePlatform?: () => boolean } };
  return Boolean(w.Capacitor?.isNativePlatform?.());
}

/**
 * Request the user's current position. Uses Capacitor's native plugin inside
 * the app (more accurate, more reliable battery management), browser
 * geolocation on the web. Throws on error or denial.
 */
export async function getCurrentPosition(): Promise<Coords> {
  if (await isNative()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    // The native plugin handles permissions internally; on first call Android
    // shows the system permission dialog.
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 300_000,
    });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  }

  // Browser fallback.
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    throw new Error("Geolocation not supported");
  }
  return new Promise<Coords>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 60_000 },
    );
  });
}
