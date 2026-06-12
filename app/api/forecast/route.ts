import { NextResponse } from "next/server";
import { fetchSmhi } from "@/lib/smhi";
import { fetchDmi } from "@/lib/dmi";
import { fetchOpenMeteo } from "@/lib/openmeteo";
import { compareForecasts } from "@/lib/compare";

export const runtime = "nodejs";

/**
 * Node's fetch throws a generic "fetch failed" and stashes the real reason
 * (ENOTFOUND, ETIMEDOUT, ECONNREFUSED, TLS errors…) in `error.cause`. Unwrap
 * the chain so deploy-time network failures are actually diagnosable.
 */
function describeError(err: unknown): string {
  const parts: string[] = [];
  let e: unknown = err;
  for (let i = 0; i < 4 && e != null; i++) {
    if (e instanceof Error) {
      const code = (e as { code?: string }).code;
      parts.push(code ? `${e.message} (${code})` : e.message);
      e = (e as { cause?: unknown }).cause;
    } else {
      parts.push(String(e));
      break;
    }
  }
  return parts.join(" ← ") || "Unknown error";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const label = searchParams.get("label") ?? undefined;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "Missing or invalid 'lat'/'lon' query parameters." },
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
  if (smhiRes.status === "rejected") errors.smhi = describeError(smhiRes.reason);
  if (dmiRes.status === "rejected") errors.dmi = describeError(dmiRes.reason);
  if (omRes.status === "rejected") errors.openmeteo = describeError(omRes.reason);

  if (!smhi && !dmi && !openmeteo) {
    return NextResponse.json(
      { error: "All providers failed.", details: errors },
      { status: 502 },
    );
  }

  const result = compareForecasts(lat, lon, smhi, dmi, openmeteo, errors, label);
  return NextResponse.json(result);
}
