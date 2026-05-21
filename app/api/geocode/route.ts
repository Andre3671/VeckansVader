import { NextResponse } from "next/server";
import { geocode, reverseGeocode } from "@/lib/geocode";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  // Reverse geocode: ?lat=&lon=
  if (lat != null && lon != null) {
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) {
      return NextResponse.json({ error: "Invalid lat/lon." }, { status: 400 });
    }
    try {
      const result = await reverseGeocode(la, lo);
      return NextResponse.json({ result });
    } catch (e: unknown) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 502 },
      );
    }
  }

  // Forward geocode: ?q=
  if (!q) return NextResponse.json({ results: [] });
  try {
    const results = await geocode(q);
    return NextResponse.json({ results });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
