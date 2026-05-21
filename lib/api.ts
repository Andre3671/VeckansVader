/**
 * API base URL.
 *
 * - Web build: empty string → relative `/api/...` paths.
 * - App build (Capacitor): set NEXT_PUBLIC_API_BASE=https://veckansvader.se
 *   at build time so the static bundle calls the hosted backend.
 *
 * Public env vars in Next.js must be prefixed with NEXT_PUBLIC_ to be
 * available in the browser bundle.
 */
const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE?.trim() ?? "";

// Strip trailing slash so callers can do `apiUrl("/api/foo")` safely.
export const API_BASE = RAW_BASE.replace(/\/+$/, "");

/** Build a full URL for an API call. Use this instead of `/api/...` literals. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}
