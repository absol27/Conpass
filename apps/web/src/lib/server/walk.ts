import "server-only";
import { setWalkMatrix, type WalkMatrix } from "../venue";

const REFRESH_MS = 5 * 60_000;
const RETRY_MS = 30_000;
let nextLoad = 0;

/**
 * Makes travelMinutes() use the maps service's real walk times on the server (MAPS_URL, e.g. http://maps:8080).
 * Refreshes every 5 minutes; when maps is unreachable it keeps the last good matrix (or the estimates) and retries in 30s,
 * so a maps outage never adds more than one short timeout.
 */
export async function loadWalkMatrix(): Promise<void> {
  const base = process.env.MAPS_URL;
  if (!base || Date.now() < nextLoad) return;
  nextLoad = Date.now() + RETRY_MS;
  try {
    const res = await fetch(`${base}/map/api/walk-matrix`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    if (!res.ok) return;
    setWalkMatrix((await res.json()) as WalkMatrix);
    nextLoad = Date.now() + REFRESH_MS;
  } catch {
    // Keep what we have.
  }
}
