/**
 * Tiny visitor counter — unique IPs per day, persisted to a JSON file.
 *
 * Why not real analytics:
 *   - User wants no external services
 *   - "Besökare denna vecka" needs ~14 days of memory tops, not full analytics
 *
 * Privacy:
 *   - IPs are SHA-256 hashed with a server-local salt before storage. The
 *     raw IP never touches disk. Hashes are 12 chars (96 bits) which is
 *     enough to disambiguate visitors but not enough to recover an IP.
 *   - We prune buckets older than 14 days, so the file stays small even
 *     for popular sites.
 *
 * Storage:
 *   - File path defaults to /app/data/visitors.json (mounted as a Docker
 *     volume to /mnt/user/appdata/veckansvader/data on Unraid). Override
 *     with VISITORS_FILE env var.
 *   - Format: { "2026-05-16": ["abc123…", "def456…"], … }
 *   - Writes are debounced (max once per 30s) to avoid hammering disk.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_FILE = process.env.VISITORS_FILE ?? "/app/data/visitors.json";
// Default salt is acceptable for hashing — changing it just invalidates the
// dedupe across the change. Override via env to rotate periodically.
const SALT = process.env.VISITOR_SALT ?? "vv-2026-default-salt";
const PRUNE_DAYS = 14;
const WRITE_DEBOUNCE_MS = 30_000;

type Buckets = Map<string, Set<string>>;

let buckets: Buckets | null = null;
let loadPromise: Promise<void> | null = null;
let writeTimer: NodeJS.Timeout | null = null;
let lastWriteAt = 0;

async function ensureLoaded(): Promise<void> {
  if (buckets !== null) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const b: Buckets = new Map();
    try {
      const raw = await fs.readFile(DATA_FILE, "utf8");
      const data = JSON.parse(raw) as Record<string, string[]>;
      for (const [day, hashes] of Object.entries(data)) {
        b.set(day, new Set(hashes));
      }
    } catch {
      // No file yet, or corrupted — start fresh.
    }
    buckets = b;
  })();
  return loadPromise;
}

function hashIp(ip: string): string {
  return crypto
    .createHash("sha256")
    .update(SALT + ":" + ip)
    .digest("base64url")
    .slice(0, 12);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function pruneOld() {
  if (!buckets) return;
  const cutoff = new Date(Date.now() - PRUNE_DAYS * 86400_000)
    .toISOString()
    .slice(0, 10);
  for (const key of buckets.keys()) {
    if (key < cutoff) buckets.delete(key);
  }
}

function scheduleWrite() {
  if (writeTimer) return;
  const wait = Math.max(0, WRITE_DEBOUNCE_MS - (Date.now() - lastWriteAt));
  writeTimer = setTimeout(async () => {
    writeTimer = null;
    await flush();
  }, wait);
  // Don't keep the process alive solely for this timer.
  writeTimer.unref?.();
}

async function flush() {
  if (!buckets) return;
  lastWriteAt = Date.now();
  const out: Record<string, string[]> = {};
  for (const [day, set] of buckets) out[day] = [...set];
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = DATA_FILE + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(out));
    await fs.rename(tmp, DATA_FILE);
  } catch (e) {
    console.error("[visitor-counter] flush failed:", e);
  }
}

/** Record one visit. Idempotent within a calendar day per IP. */
export async function recordVisit(ip: string): Promise<void> {
  if (!ip || ip === "unknown") return;
  await ensureLoaded();
  const day = todayKey();
  const hash = hashIp(ip);
  let bucket = buckets!.get(day);
  if (!bucket) {
    bucket = new Set();
    buckets!.set(day, bucket);
  }
  if (bucket.has(hash)) return;
  bucket.add(hash);
  pruneOld();
  scheduleWrite();
}

/**
 * Number of unique visitors over the last `days` days (default 7).
 * Counts each hash once across the window — i.e. a visitor who came
 * five days this week counts as 1.
 */
export async function getUniqueVisitors(days = 7): Promise<number> {
  await ensureLoaded();
  const cutoff = new Date(Date.now() - days * 86400_000)
    .toISOString()
    .slice(0, 10);
  const all = new Set<string>();
  for (const [day, hashes] of buckets!) {
    if (day >= cutoff) {
      for (const h of hashes) all.add(h);
    }
  }
  return all.size;
}
