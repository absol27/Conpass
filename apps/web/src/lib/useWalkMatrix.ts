"use client";
import { useEffect, useSyncExternalStore } from "react";
import { setWalkMatrix, subscribeWalkMatrix, walkMatrixVersion, type WalkMatrix } from "./venue";

let requested = false;

/**
 * Loads real walk times from the maps service once per page load and re-renders the caller when they arrive.
 * Call it in any component that renders travelMinutes(). If maps is unreachable, the estimates stay in use.
 */
export function useWalkMatrix() {
  useEffect(() => {
    if (requested) return;
    requested = true;
    fetch("/map/api/walk-matrix")
      .then((r) => (r.ok ? (r.json() as Promise<WalkMatrix>) : null))
      .then((m) => m && setWalkMatrix(m))
      .catch(() => {});
  }, []);
  return useSyncExternalStore(subscribeWalkMatrix, walkMatrixVersion, () => 0);
}
