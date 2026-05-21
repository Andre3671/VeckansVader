import { NextResponse } from "next/server";
import { fetchSmhi } from "@/lib/smhi";
import { fetchDmi } from "@/lib/dmi";
import { fetchOpenMeteo } from "@/lib/openmeteo";
import { compareForecasts } from "@/lib/compare";

export const runtime = "nodejs";

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
  if (smhiRes.status === "rejected") errors.smhi = String(smhiRes.reason?.message ?? smhiRes.reason);
  if (dmiRes.status === "rejected") errors.dmi = String(dmiRes.reason?.message ?? dmiRes.reason);
  if (omRes.status === "rejected") errors.openmeteo = String(omRes.reason?.message ?? omRes.reason);

  if (!smhi && !dmi && !openmeteo) {
    return NextResponse.json(
      { error: "All providers failed.", details: errors },
      { status: 502 },
    );
  }

  const result = compareForecasts(lat, lon, smhi, dmi, openmeteo, errors, label);
  return NextResponse.json(result);
}
