import { NextResponse } from "next/server";
import { trackVisitor } from "@/lib/visitors";

export const runtime = "nodejs";

/**
 * GET /api/stats/visitors
 *
 * Registers the caller as a unique visitor for the current ISO week and
 * returns the running count. Idempotent within a week — same IP repeated
 * doesn't inflate the number.
 *
 * Response: { thisWeek: number }
 *
 * Privacy: only an irreversible per-week hash of the IP is stored, see
 * lib/visitors.ts.
 */
export async function GET(req: Request) {
  // Trust the proxy's X-Forwarded-For (NPM/Cloudflare set this). Falls back
  // to a constant string so the IP-less local case still works in dev.
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "local";

  const result = await trackVisitor(ip);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
