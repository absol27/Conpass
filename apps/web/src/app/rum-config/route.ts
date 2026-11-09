import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Browser monitoring settings for the Dash0 Web SDK, read at runtime from Secret `dash0` so nothing is baked into the build.
 * The browser token can only ingest telemetry; it is meant to be public. Returns {} when monitoring isn't configured.
 */
export function GET() {
  const url = process.env.DASH0_ENDPOINT;
  const authToken = process.env.DASH0_BROWSER_TOKEN;
  if (!url || !authToken) return NextResponse.json({});
  return NextResponse.json({ url, authToken, dataset: process.env.DASH0_DATASET ?? "default", version: process.env.APP_VERSION ?? "dev" });
}
