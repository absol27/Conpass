"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Directions } from "./Directions";
import { SettingsSheet } from "./SettingsSheet";
import { DEFAULT_SETTINGS, type Detour, type RouteResult, type RouteSettings, type Venue } from "./types";
import "./hallway.css";

// Leaflet touches `window` when it loads, so the map only renders in the browser.
const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), { ssr: false });

const SETTINGS_KEY = "conpass.route-settings";

function loadSettings(): RouteSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<RouteSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let venueRequest: Promise<Venue | null> | null = null;
const loadVenue = () =>
  (venueRequest ??= fetch("/map/api/venue")
    .then((r) => (r.ok ? (r.json() as Promise<Venue>) : null))
    .catch(() => null));

/**
 * Hallway wayfinding between two rooms (apps/web room ids): the floor-plan map with the route drawn on it,
 * turn-by-turn directions, a restroom on the way, amenities, and walking/accessibility settings.
 * Venue data and routes come from the maps service.
 */
export function HallwayRoute({ from, to }: { from: string; to: string }) {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [settings, setSettings] = useState<RouteSettings>(DEFAULT_SETTINGS);
  const [found, setFound] = useState<{ result: RouteResult; restroom: Detour | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const [showPois, setShowPois] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    loadVenue().then((v) => (v ? setVenue(v) : setFailed(true)));
  }, []);

  useEffect(() => {
    const q = new URLSearchParams({ from, to, settings: JSON.stringify(settings) });
    const ctrl = new AbortController();
    fetch(`/map/api/route?${q}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { result: RouteResult; restroom: Detour | null }) => {
        setFound(body);
        setFailed(false);
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setFailed(true);
      });
    return () => ctrl.abort();
  }, [from, to, settings]);

  const changeSettings = (s: RouteSettings) => {
    setSettings(s);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      // Private mode: settings last for this visit only.
    }
  };

  if (failed && !found) return <p className="mt-2 text-sm text-[var(--muted)]">The venue map isn&apos;t available right now.</p>;

  const route = found?.result.kind === "ok" ? found.result.route : null;
  return (
    <div className="hallway mt-3">
      <div className="mb-2 flex flex-wrap gap-2">
        <button className="chip" aria-pressed={showPois} onClick={() => setShowPois(!showPois)}>
          Amenities
        </button>
        <button className="chip" onClick={() => setSettingsOpen(true)}>
          Walking &amp; accessibility · {settings.speed.toFixed(1)} m/s{settings.stepFree ? " · step-free" : ""}
        </button>
      </div>
      {venue && (
        <div className="map-wrap" style={{ height: 340, borderRadius: 12, overflow: "hidden" }}>
          <MapView venue={venue} route={route} showPois={showPois} />
        </div>
      )}
      {venue && (
        <div className="directions" style={{ padding: "12px 0 0" }}>
          <Directions venue={venue} result={found?.result ?? null} settings={settings} restroom={found?.restroom ?? null} />
        </div>
      )}
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onChange={changeSettings} />
    </div>
  );
}
