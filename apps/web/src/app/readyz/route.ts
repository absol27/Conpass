import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Readiness probe. Deliberately ignores Elasticsearch: the app falls back to local logic when ES is down. */
export function GET() {
  return NextResponse.json({ status: "ready" });
}
