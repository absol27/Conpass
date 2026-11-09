"use client";
import { useEffect } from "react";

type RumConfig = { url?: string; authToken?: string; dataset?: string; version?: string };

let started = false;

/** Real-user monitoring: page views, Core Web Vitals, errors and fetch timings from attendees' phones, sent to Dash0. */
export function Rum() {
  useEffect(() => {
    if (started) return;
    started = true;
    fetch("/rum-config")
      .then((r): Promise<RumConfig> | RumConfig => (r.ok ? r.json() : {}))
      .then(async (c) => {
        if (!c.url || !c.authToken) return;
        const { init } = await import("@dash0/sdk-web");
        init({ serviceName: "web-browser", serviceVersion: c.version, endpoint: { url: c.url, authToken: c.authToken, dataset: c.dataset } });
      })
      .catch(() => {});
  }, []);
  return null;
}
