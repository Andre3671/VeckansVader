/**
 * Simple in-memory sliding window rate limiter.
 * Tracks request timestamps per IP; rejects if more than `max` in `windowMs`.
 */
const store = new Map<string, number[]>();

// Clean up stale entries periodically to avoid unbounded memory.
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, times] of store) {
    const valid = times.filter((t) => t > cutoff);
    if (valid.length === 0) store.delete(key);
    else store.set(key, valid);
  }
}

export function rateLimit(
  ip: string,
  { max = 30, windowMs = 60_000 } = {},
): { allowed: boolean; remaining: number; resetMs: number } {
  cleanup(windowMs);
  const now = Date.now();
  const cutoff = now - windowMs;
  const times = (store.get(ip) ?? []).filter((t) => t > cutoff);

  if (times.length >= max) {
    const oldest = times[0];
    return { allowed: false, remaining: 0, resetMs: oldest + windowMs - now };
  }

  times.push(now);
  store.set(ip, times);
  return { allowed: true, remaining: max - times.length, resetMs: windowMs };
}
