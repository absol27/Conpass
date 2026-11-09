import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe. Also reports the deployed build, so a deploy can be verified at /healthz. */
export function GET() {
  return NextResponse.json({ status: "ok", version: process.env.APP_VERSION ?? "dev" });
}
