"use client";
import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, type RouteSettings } from "../components/hallway/types";
import { setWalkMatrix, subscribeWalkMatrix, walkMatrixVersion, type WalkMatrix } from "./venue";

let requested: string | null = null;

/**
 * Loads real walk times for the requested walking speed and accessibility preference, then re-renders callers.
 * Call it in any component that renders travelMinutes(). If maps is unreachable, the estimates stay in use.
 */
export function useWalkMatrix(settings: Pick<RouteSettings, "speed" | "stepFree"> = DEFAULT_SETTINGS) {
  useEffect(() => {
    const query = new URLSearchParams({ speed: String(settings.speed), stepFree: String(settings.stepFree) });
    const key = query.toString();
    if (requested === key) return;
    requested = key;
    fetch(`/map/api/walk-matrix?${query}`)
      .then((r) => (r.ok ? (r.json() as Promise<WalkMatrix>) : null))
      .then((m) => {
        if (requested !== key) return;
        if (m) setWalkMatrix(m);
        else requested = null;
      })
      .catch(() => {
        if (requested === key) requested = null;
      });
  }, [settings.speed, settings.stepFree]);
  return useSyncExternalStore(subscribeWalkMatrix, walkMatrixVersion, () => 0);
}
