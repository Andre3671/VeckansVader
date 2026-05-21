import { NextResponse } from "next/server";
import { fetchSmhi } from "@/lib/smhi";
import { fetchDmi } from "@/lib/dmi";
import { fetchOpenMeteo } from "@/lib/openmeteo";
import { compareForecasts } from "@/lib/compare";
import { rateLimit } from "@/lib/ratelimit";
import { geocode } from "@/lib/geocode";

export const runtime = "nodejs";

// 30 requests per minute per IP.
const RATE_MAX = 30;
const RATE_WINDOW_MS = 60_000;

/**
 * GET /api/estimate?lat=55.64&lon=13.21
 *   or
 * GET /api/estimate?place=Stockholm
 *
 * Returns a clean, consumer-friendly blended weekly forecast:
 *
 * {
 *   location: { lat, lon },
 *   weights: { smhi: 0.47, dmi: 0.33, openmeteo: 0.20 },
 *   forecast: [
 *     {
 *       date: "2026-05-14",
 *       condition: "partly-cloudy",
 *       temperature: { min: 5.1, max: 13.2, mean: 9.4 },
 *       precipitation: { mm: 0.3 },
 *       wind: { mean_ms: 3.2, max_ms: 6.1 },
 *       humidity: 72,
 *       cloud_cover: 54,
 *       agreement: 0.92,
 *       sources: { smhi: true, dmi: true, openmeteo: true }
 *     },
 *     ...
 *   ]
 * }
 */
export async function GET(req: Request) {
  // Rate limit by IP.
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit(ip, { max: RATE_MAX, windowMs: RATE_WINDOW_MS });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.resetMs / 1000)),
          "X-RateLimit-Limit": String(RATE_MAX),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const { searchParams } = new URL(req.url);
  const place = searchParams.get("place")?.trim();
  const latRaw = searchParams.get("lat");
  const lonRaw = searchParams.get("lon");
  let lat = latRaw != null ? Number(latRaw) : NaN;
  let lon = lonRaw != null ? Number(lonRaw) : NaN;
  let resolvedLabel: string | undefined;

  // If `place=` is given (and lat/lon aren't), geocode it.
  if (place && (!Number.isFinite(lat) || !Number.isFinite(lon))) {
    try {
      const hits = await geocode(place, 1);
      if (!hits.length) {
        return NextResponse.json(
          { error: `No location found for place='${place}'.` },
          { status: 404 },
        );
      }
      lat = hits[0].lat;
      lon = hits[0].lon;
      resolvedLabel = hits[0].label;
    } catch (e: unknown) {
      return NextResponse.json(
        { error: `Geocoding failed: ${e instanceof Error ? e.message : String(e)}` },
        { status: 502 },
      );
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "Provide either 'place=<name>' or both 'lat' and 'lon'." },
      { status: 400 },
    );
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json(
      { error: "'lat' must be in [-90,90] and 'lon' in [-180,180]." },
      { status: 400 },
    );
  }

  const [smhiRes, dmiRes, omRes] = await Promise.allSettled([
    fetchSmhi(lat, lon),
    fetchDmi(lat, lon),
    fetchOpenMeteo(lat, lon),
  ]);

  const smhi = smhiRes.status === "fulfilled" ? smhiRes.value : null;
  const dmi = dmiRes.status === "fulfilled" ? dmiRes.value : null;
  const openmeteo = omRes.status === "fulfilled" ? omRes.value : null;
  const errors: { smhi?: string; dmi?: string; openmeteo?: string } = {};
  if (smhiRes.status === "rejected") errors.smhi = String(smhiRes.reason?.message ?? smhiRes.reason);
  if (dmiRes.status === "rejected") errors.dmi = String(dmiRes.reason?.message ?? dmiRes.reason);
  if (omRes.status === "rejected") errors.openmeteo = String(omRes.reason?.message ?? omRes.reason);

  if (!smhi && !dmi && !openmeteo) {
    return NextResponse.json(
      { error: "All providers failed.", details: errors },
      { status: 502 },
    );
  }

  const compared = compareForecasts(lat, lon, smhi, dmi, openmeteo, errors);

  const forecast = compared.days.map((day) => ({
    date: day.date,
    condition: day.blend.condition,
    temperature: {
      min: round(day.blend.tempMin),
      max: round(day.blend.tempMax),
      mean: round(day.blend.tempMean),
    },
    precipitation: {
      mm: round(day.blend.precipitation),
    },
    wind: {
      mean_ms: round(day.blend.windMean),
      max_ms: round(day.blend.windMax),
    },
    humidity: round(day.blend.humidityMean, 0),
    cloud_cover: round(day.blend.cloudMean, 0),
    agreement: round(day.agreement, 2),
    sources: {
      smhi: day.smhi != null,
      dmi: day.dmi != null,
      openmeteo: day.openmeteo != null,
    },
  }));

  const result = {
    location: resolvedLabel ? { lat, lon, name: resolvedLabel } : { lat, lon },
    weights: {
      smhi: round(compared.weights.smhi, 2),
      dmi: round(compared.weights.dmi, 2),
      openmeteo: round(compared.weights.openmeteo, 2),
    },
    forecast,
    ...(Object.keys(errors).length ? { errors } : {}),
  };

  return NextResponse.json(result);
}

function round(v: number | null, decimals = 1): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
