/**
 * Persistent unique-visitor counter ("besökare totalt").
 *
 * Stores irreversible fingerprints of caller IPs so we can show an all-time
 * unique-visitor count in the footer without keeping any personally
 * identifiable data:
 *
 *   1. A single random salt (32 bytes) is generated once and persisted. It is
 *      never rotated, so the same IP always maps to the same fingerprint and
 *      can be deduped across the whole lifetime of the counter.
 *   2. Every visitor's IP is hashed with the salt:
 *        fingerprint = sha256(ip + salt) truncated to 16 chars
 *   3. The fingerprint goes into a Set (dedups repeat visits from the same IP).
 *   4. The raw IP never touches disk; the salt is secret, so a stored
 *      fingerprint can't be turned back into an IP.
 *
 * Persisted to disk (debounced) so the count survives container restarts.
 * The data dir should point at a mounted volume in prod (VISITOR_DATA_DIR).
 */

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

// Path can be overridden via env var so prod can point at a mounted volume.
const DATA_DIR = process.env.VISITOR_DATA_DIR ?? "/tmp/veckansvader-stats";
const FILE = path.join(DATA_DIR, "visitors.json");

interface PersistedState {
  salt: string;           // hex, generated once, never rotated
  fingerprints: string[]; // unique hashes seen all-time
}

interface MemoryState {
  salt: string;
  fingerprints: Set<string>;
}

let state: MemoryState | null = null;
let dirty = false;
let flushTimer: NodeJS.Timeout | null = null;

function freshSalt(): string {
  return crypto.randomBytes(32).toString("hex");
}

function newState(): MemoryState {
  return { salt: freshSalt(), fingerprints: new Set() };
}

function fingerprint(ip: string, salt: string): string {
  return crypto.createHash("sha256").update(ip + salt).digest("hex").slice(0, 16);
}

async function load(): Promise<void> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (parsed.salt && Array.isArray(parsed.fingerprints)) {
      state = {
        salt: parsed.salt,
        fingerprints: new Set(parsed.fingerprints),
      };
      return;
    }
  } catch {
    // File missing or unreadable — fall through to a fresh counter.
  }
  state = newState();
  // Persist the freshly minted salt so it's stable across restarts.
  dirty = true;
  scheduleFlush();
}

async function save(): Promise<void> {
  if (!state) return;
  const out: PersistedState = {
    salt: state.salt,
    fingerprints: [...state.fingerprints],
  };
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(out));
  } catch {
    // Best-effort — if disk is read-only or full we just lose the count
    // on restart. Acceptable for a vanity stat.
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (dirty) {
      dirty = false;
      void save();
    }
  }, 5000);
  flushTimer.unref?.();
}

/** Mark this IP as a visitor and return the all-time unique count so far. */
export async function trackVisitor(ip: string): Promise<{ total: number }> {
  if (!state) await load();
  if (!state) state = newState();
  const fp = fingerprint(ip, state.salt);
  if (!state.fingerprints.has(fp)) {
    state.fingerprints.add(fp);
    dirty = true;
    scheduleFlush();
  }
  return { total: state.fingerprints.size };
}

/** Read-only: all-time unique-visitor count. */
export async function getVisitorCount(): Promise<{ total: number }> {
  if (!state) await load();
  if (!state) return { total: 0 };
  return { total: state.fingerprints.size };
}
