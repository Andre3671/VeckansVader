/**
 * Tiny "visitors this week" counter.
 *
 * Stores irreversible per-week fingerprints of caller IPs so we can show a
 * unique-visitor count in the footer without keeping any personally
 * identifiable data:
 *
 *   1. Each ISO week (Mon-Sun) starts with a fresh random salt (32 bytes).
 *   2. Every new visitor's IP is hashed with the week's salt:
 *        fingerprint = sha256(ip + salt) truncated to 16 chars
 *   3. The fingerprint goes into the week's Set (dedups same-IP repeat visits).
 *   4. When the ISO week rolls over the salt + Set are wiped — last week's
 *      hashes can never be linked to this week's IPs because the salt is gone.
 *
 * Persisted to disk (debounced) so the count survives container restarts
 * within the same week. If the file is missing or the week doesn't match
 * the current one, we start fresh.
 */

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

// Path can be overridden via env var so prod can point at a mounted volume.
const DATA_DIR = process.env.VISITOR_DATA_DIR ?? "/tmp/veckansvader-stats";
const FILE = path.join(DATA_DIR, "visitors.json");

interface PersistedState {
  week: string;          // ISO week id, e.g. "2026-W20"
  salt: string;          // hex, regenerated each week
  fingerprints: string[]; // unique hashes seen this week
}

interface MemoryState {
  week: string;
  salt: string;
  fingerprints: Set<string>;
}

let state: MemoryState | null = null;
let dirty = false;
let flushTimer: NodeJS.Timeout | null = null;

/**
 * Returns an ISO week identifier like "2026-W20" for the current UTC date.
 * ISO weeks start on Monday; week 1 is the one containing the first Thursday
 * of the year.
 */
function currentIsoWeek(): string {
  const d = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  ));
  // Shift Sunday=0 → 7, then add days so we land on Thursday of the same week.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function freshSalt(): string {
  return crypto.randomBytes(32).toString("hex");
}

function newWeekState(): MemoryState {
  return { week: currentIsoWeek(), salt: freshSalt(), fingerprints: new Set() };
}

function fingerprint(ip: string, salt: string): string {
  return crypto.createHash("sha256").update(ip + salt).digest("hex").slice(0, 16);
}

async function load(): Promise<void> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.week === currentIsoWeek() && parsed.salt && Array.isArray(parsed.fingerprints)) {
      state = {
        week: parsed.week,
        salt: parsed.salt,
        fingerprints: new Set(parsed.fingerprints),
      };
      return;
    }
  } catch {
    // File missing or unreadable — fall through.
  }
  state = newWeekState();
}

async function save(): Promise<void> {
  if (!state) return;
  const out: PersistedState = {
    week: state.week,
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

function rolloverIfNeeded() {
  if (state && state.week !== currentIsoWeek()) {
    state = newWeekState();
    dirty = true;
    scheduleFlush();
  }
}

/** Mark this IP as a visitor this week and return the week's count so far. */
export async function trackVisitor(ip: string): Promise<{ thisWeek: number }> {
  if (!state) await load();
  if (!state) state = newWeekState();
  rolloverIfNeeded();
  const fp = fingerprint(ip, state.salt);
  if (!state.fingerprints.has(fp)) {
    state.fingerprints.add(fp);
    dirty = true;
    scheduleFlush();
  }
  return { thisWeek: state.fingerprints.size };
}

/** Read-only: this week's unique-visitor count. */
export async function getVisitorCount(): Promise<{ thisWeek: number }> {
  if (!state) await load();
  if (!state) return { thisWeek: 0 };
  rolloverIfNeeded();
  return { thisWeek: state.fingerprints.size };
}
