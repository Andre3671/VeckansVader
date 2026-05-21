import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CORS for the public JSON API.
 *
 * Allow any origin so the API can be consumed from anywhere — including
 * the Capacitor Android app (origin: https://localhost) and third-party
 * integrations. The endpoints are public, rate-limited, read-only.
 */
export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";

  // Preflight: short-circuit before the handler runs.
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      },
    });
  }

  const res = NextResponse.next();
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
