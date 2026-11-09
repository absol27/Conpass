import { DEFAULT_SETTINGS, type RouteSettings } from "./types";

export const SETTINGS_KEY = "conpass.route-settings";

export function loadSettings(): RouteSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<RouteSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: RouteSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private mode: settings last for this visit only.
  }
}
