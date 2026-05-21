#!/usr/bin/env node
/**
 * Render the SVG sources in resources/ into all Android mipmap PNG sizes
 * and write them into android/app/src/main/res/.
 *
 * Inputs:
 *   resources/icon-background.svg  (solid gradient — Android adaptive bg)
 *   resources/icon-foreground.svg  (the symbol — Android adaptive fg)
 *
 * Outputs (per density):
 *   mipmap-<density>/
 *     ic_launcher.png            (legacy square icon, bg+fg flattened)
 *     ic_launcher_round.png      (legacy circular icon)
 *     ic_launcher_foreground.png (adaptive fg layer, transparent bg)
 *
 *   mipmap-anydpi-v26/
 *     ic_launcher.xml            (declares adaptive icon: bg colour + fg drawable)
 *     ic_launcher_round.xml      (same, round variant)
 *
 *   values/
 *     ic_launcher_background.xml (the gradient is rasterised, but we also
 *                                  set a solid colour fallback for older
 *                                  Android-tools chains.)
 *
 * Usage: node scripts/build-icons.js
 */

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const SRC_BG = path.join(ROOT, "resources", "icon-background.svg");
const SRC_FG = path.join(ROOT, "resources", "icon-foreground.svg");
const RES = path.join(ROOT, "android", "app", "src", "main", "res");

// Android launcher icon sizes per density. The adaptive foreground/background
// layers must be 108dp; the visible "safe zone" is the centre 72dp (66%).
const DENSITIES = [
  { name: "mdpi",    px: 48,  fg: 108 },
  { name: "hdpi",    px: 72,  fg: 162 },
  { name: "xhdpi",   px: 96,  fg: 216 },
  { name: "xxhdpi",  px: 144, fg: 324 },
  { name: "xxxhdpi", px: 192, fg: 432 },
];

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

async function renderPng(svgPath, sizePx, outPath) {
  const svg = await fs.promises.readFile(svgPath);
  await sharp(svg, { density: 384 })
    .resize(sizePx, sizePx, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
}

async function renderFlattenedLegacyIcon(sizePx, outPath, { round = false } = {}) {
  const bgPng = await sharp(await fs.promises.readFile(SRC_BG), { density: 384 })
    .resize(sizePx, sizePx)
    .png()
    .toBuffer();
  const fgPng = await sharp(await fs.promises.readFile(SRC_FG), { density: 384 })
    .resize(sizePx, sizePx)
    .png()
    .toBuffer();

  let composite = sharp(bgPng).composite([{ input: fgPng, blend: "over" }]);

  if (round) {
    // Mask everything outside the inscribed circle.
    const r = sizePx / 2;
    const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}"><circle cx="${r}" cy="${r}" r="${r}" fill="white"/></svg>`;
    composite = composite.composite([
      { input: fgPng, blend: "over" },
      { input: Buffer.from(maskSvg), blend: "dest-in" },
    ]);
  }

  await composite.png().toFile(outPath);
}

const ADAPTIVE_ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

async function main() {
  console.log("→ Rendering app icons…");

  for (const d of DENSITIES) {
    const dir = path.join(RES, `mipmap-${d.name}`);
    await ensureDir(dir);

    // Adaptive foreground (transparent bg, the symbol)
    await renderPng(SRC_FG, d.fg, path.join(dir, "ic_launcher_foreground.png"));
    // Adaptive background (the gradient as a PNG — alternative to a vector
    // drawable, simpler and renders identically).
    await renderPng(SRC_BG, d.fg, path.join(dir, "ic_launcher_background.png"));

    // Legacy launcher icons for older Android (pre-API 26).
    await renderFlattenedLegacyIcon(d.px, path.join(dir, "ic_launcher.png"));
    await renderFlattenedLegacyIcon(d.px, path.join(dir, "ic_launcher_round.png"), { round: true });

    console.log(`  ✓ ${d.name} (${d.px}px / fg ${d.fg}px)`);
  }

  // Adaptive icon XML — points at the foreground/background drawables above.
  const anydpiDir = path.join(RES, "mipmap-anydpi-v26");
  await ensureDir(anydpiDir);
  await fs.promises.writeFile(path.join(anydpiDir, "ic_launcher.xml"), ADAPTIVE_ICON_XML);
  await fs.promises.writeFile(path.join(anydpiDir, "ic_launcher_round.xml"), ADAPTIVE_ICON_XML);
  console.log("  ✓ adaptive icon XML");

  console.log("\n✓ Icons generated. Rebuild the APK to see them.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
