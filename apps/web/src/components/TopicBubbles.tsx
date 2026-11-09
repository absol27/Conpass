"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { conference, sessions } from "@/lib/data";

const MAX_D = 250; // diameter of the biggest topic, in px
const FULL_LABEL_MIN_D = 92; // smaller circles show a short label
const GAP = 8; // px between packed circles, leaves room for the selection ring
const SEED = 11; // fixed shuffle, so the "random" order is identical on server and client (no hydration mismatch)

type Topic = { id: string; label: string; blurb: string; color: string; count: number; d: number };
type Placed = Topic & { x: number; y: number };

/** Small seeded PRNG (mulberry32). */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], seed: number): T[] {
  const out = [...list];
  const rand = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Greedy circle packing: each circle goes in the free spot touching one or two placed circles
 * that is closest to the middle (stretched sideways so the cluster fills a wide row).
 */
function pack(items: Topic[]): Placed[] {
  const placed: Placed[] = [];
  for (const it of items) {
    const r = it.d / 2;
    if (!placed.length) {
      placed.push({ ...it, x: 0, y: 0 });
      continue;
    }
    const best = { x: 0, y: 0, score: Infinity };
    const consider = (x: number, y: number) => {
      const score = Math.hypot(x / 1.7, y);
      if (score >= best.score) return;
      if (placed.every((c) => Math.hypot(x - c.x, y - c.y) >= c.d / 2 + r + GAP - 0.01)) Object.assign(best, { x, y, score });
    };
    placed.forEach((a, i) => {
      const ra = a.d / 2 + r + GAP;
      for (let k = 0; k < 48; k++) consider(a.x + ra * Math.cos((k / 24) * Math.PI), a.y + ra * Math.sin((k / 24) * Math.PI));
      // spots touching both a and b (intersection of the two "touching" rings)
      for (const b of placed.slice(i + 1)) {
        const rb = b.d / 2 + r + GAP;
        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
        if (dist === 0 || dist > ra + rb || dist < Math.abs(ra - rb)) continue;
        const along = (ra * ra - rb * rb + dist * dist) / (2 * dist);
        const h = Math.sqrt(Math.max(0, ra * ra - along * along));
        const mx = a.x + (dx * along) / dist, my = a.y + (dy * along) / dist;
        consider(mx - (dy * h) / dist, my + (dx * h) / dist);
        consider(mx + (dy * h) / dist, my - (dx * h) / dist);
      }
    });
    placed.push({ ...it, x: best.x, y: best.y });
  }
  return placed;
}

/**
 * One circle per topic, packed together in a shuffled order. Circle AREA is proportional to the number of
 * sessions tagged with it (diameter ∝ √count), so a circle twice the area means twice the sessions.
 * Tap or hover a circle to read what the topic covers.
 */
export function TopicBubbles() {
  const { bubbles, box } = useMemo(() => {
    const count = new Map<string, number>();
    for (const s of sessions) if (s.kind !== "activity") for (const t of s.topics) count.set(t, (count.get(t) ?? 0) + 1);
    const max = Math.max(...conference.topics.map((t) => count.get(t.id) ?? 0));
    const sized = conference.topics.map((t) => {
      const n = count.get(t.id) ?? 0;
      return { ...t, count: n, d: Math.round(MAX_D * Math.sqrt(n / max)) };
    });
    const placed = pack(shuffle(sized, SEED));
    const minX = Math.min(...placed.map((b) => b.x - b.d / 2)), maxX = Math.max(...placed.map((b) => b.x + b.d / 2));
    const minY = Math.min(...placed.map((b) => b.y - b.d / 2)), maxY = Math.max(...placed.map((b) => b.y + b.d / 2));
    return {
      bubbles: placed.map((b) => ({ ...b, x: b.x - minX, y: b.y - minY })),
      box: { w: Math.ceil(maxX - minX), h: Math.ceil(maxY - minY) },
    };
  }, []);

  const [selected, setSelected] = useState(() => bubbles.reduce((a, b) => (b.count > a.count ? b : a)).id);
  const active = bubbles.find((t) => t.id === selected)!;

  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = width ? Math.min(1, width / box.w) : 1;
  const packed = scale >= 0.7; // on phones the packed cluster would be too small to read, so wrap instead

  const circle = (t: Placed, style: React.CSSProperties = {}) => {
    const on = t.id === selected;
    const full = t.d >= FULL_LABEL_MIN_D;
    return (
      <button
        key={t.id}
        role="listitem"
        onClick={() => setSelected(t.id)}
        onMouseEnter={() => setSelected(t.id)}
        onFocus={() => setSelected(t.id)}
        aria-label={`${t.label}: ${t.count} sessions`}
        aria-pressed={on}
        title={`${t.label} · ${t.count} sessions`}
        className={`grid shrink-0 place-items-center rounded-full text-center outline-none transition-transform duration-200 ${on ? "z-10 scale-105" : "hover:scale-105"}`}
        style={{
          ...style,
          width: t.d,
          height: t.d,
          background: `${t.color}${on ? "40" : "24"}`,
          border: `2px solid ${t.color}`,
          boxShadow: on ? `0 0 0 3px #fff, 0 0 0 5px ${t.color}` : undefined,
        }}
      >
        {full ? (
          <span className="px-3 leading-tight">
            <span className="block text-[12px] font-bold text-[var(--ink)] sm:text-[13px]">{t.label}</span>
            <span className="mt-0.5 block text-[11px] font-medium text-[var(--muted)]">{t.count} sessions</span>
          </span>
        ) : (
          <span className="leading-none">
            <span className="block text-[9px] font-bold text-[var(--ink)]">{t.label.split(" + ")[0]}</span>
            <span className="mt-0.5 block text-[9px] text-[var(--muted)]">{t.count}</span>
          </span>
        )}
      </button>
    );
  };

  return (
    <div>
      <div ref={ref} className="w-full overflow-hidden py-2" role="list">
        {packed ? (
          <div className="relative mx-auto" style={{ width: box.w * scale, height: box.h * scale }}>
            <div className="absolute left-0 top-0 origin-top-left" style={{ width: box.w, height: box.h, transform: `scale(${scale})` }}>
              {bubbles.map((t) => circle(t, { position: "absolute", left: t.x - t.d / 2, top: t.y - t.d / 2 }))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-2">{bubbles.map((t) => circle(t))}</div>
        )}
      </div>

      <div className="glass mx-auto mt-6 flex max-w-2xl items-start gap-3 rounded-2xl p-4" aria-live="polite">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: active.color }} />
        <div>
          <div className="font-bold text-[var(--brand)]">
            {active.label} <span className="font-medium text-[var(--muted)]">· {active.count} sessions</span>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{active.blurb}</p>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-[var(--muted)]">Bigger circle = more sessions on that topic. A session can cover more than one topic.</p>
    </div>
  );
}
