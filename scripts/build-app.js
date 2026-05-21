#!/usr/bin/env node
/**
 * Build the static frontend bundle for the Android (Capacitor) app.
 *
 * Next.js 15 refuses `output: "export"` while API routes exist. We move
 * `app/api/` out of the way, run the export, then put it back — keeping the
 * web build's API routes intact in source.
 *
 * Run with: node scripts/build-app.js
 * (or via package.json: npm run build:app)
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const FINAL_OUT = path.join(ROOT, "out");

// Folders/files under `app/` that need to be moved out during the static
// export — they require server runtime (API routes, dynamic SSR routes,
// sitemap/robots metadata routes).
const EXCLUDED = [
  { src: path.join(ROOT, "app", "api"),     backup: path.join(ROOT, ".api-backup") },
  { src: path.join(ROOT, "app", "vader"),   backup: path.join(ROOT, ".vader-backup") },
  { src: path.join(ROOT, "app", "sitemap.ts"), backup: path.join(ROOT, ".sitemap.ts.bak") },
  { src: path.join(ROOT, "app", "robots.ts"),  backup: path.join(ROOT, ".robots.ts.bak") },
];

function rmSafe(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

/**
 * Move a directory using copy + delete instead of rename.
 *
 * `fs.renameSync` requires an exclusive lock on Windows and fails with EPERM
 * when any process (VS Code's TypeScript server, the Next.js dev server, the
 * Windows file indexer) has a handle inside the source tree. Copying first,
 * then deleting the source, sidesteps the lock entirely.
 */
function moveDir(src, dest) {
  if (!fs.existsSync(src)) return;
  rmSafe(dest);
  fs.cpSync(src, dest, { recursive: true });
  rmSafe(src);
}

/** Move a file (not a directory) using copy+delete to dodge file-lock issues. */
function moveFile(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.copyFileSync(src, dest);
  fs.unlinkSync(src);
}

function moveAny(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) moveDir(src, dest);
  else moveFile(src, dest);
}

let restored = false;
function restoreExcluded() {
  if (restored) return;
  for (const { src, backup } of EXCLUDED) {
    if (fs.existsSync(backup)) {
      if (fs.existsSync(src)) rmSafe(src);
      moveAny(backup, src);
    }
  }
  restored = true;
}

// Restore on any exit (including Ctrl+C / errors).
process.on("exit", restoreExcluded);
process.on("SIGINT", () => {
  restoreExcluded();
  process.exit(130);
});

try {
  // Move server-only routes out of the way for the static export.
  for (const { src, backup } of EXCLUDED) {
    if (fs.existsSync(src)) {
      rmSafe(backup);
      moveAny(src, backup);
    }
  }

  console.log("→ Building static export (APP_BUILD=1)…");
  const env = {
    ...process.env,
    APP_BUILD: "1",
    NEXT_PUBLIC_API_BASE:
      process.env.NEXT_PUBLIC_API_BASE ?? "https://veckansvader.se",
  };
  const result = spawnSync("npx", ["next", "build"], {
    cwd: ROOT,
    stdio: "inherit",
    env,
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  // Next.js writes static export to ./out/ by default.
  if (!fs.existsSync(FINAL_OUT)) {
    throw new Error(
      `Expected static export at ${FINAL_OUT}, but it does not exist. Check Next.js output above.`,
    );
  }
  console.log(`\n✓ Static app bundle in ${path.relative(ROOT, FINAL_OUT)}/`);
} finally {
  restoreExcluded();
}
