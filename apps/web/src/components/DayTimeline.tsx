"use client";
import { forwardRef, useState } from "react";
import type { Block, Session } from "@/lib/types";
import { roomById } from "@/lib/data";
import { dayEnd, dayStart, fmtTime, MIN, ms } from "@/lib/time";
import { travelMinutes } from "@/lib/venue";
import { topicColor } from "./ui";

export const PX_PER_MIN = 1.6;

/** An option from the side panel, previewed on the timeline while you hover it. */
export type TimelineOption = { session: Session; type: "fit" | "swap"; replaces: string[] };

type Props = {
  day: number;
  sessions: Session[];
  anchorIds: string[];
  blocks: Block[];
  focus: { start: number; end: number; mode: "forward" | "gap" | "replace" } | null;
  replacingId: string | null;
  /** Talks swapped out during the current backtrack, shown as ghosts where they were. */
  ghosts: Session[];
  /** The options in the side panel, so hovering one can preview it here. */
  options: TimelineOption[];
  hoverId: string | null;
  /** Clicked a spot that isn't a talk: show the options from that time. */
  onPickTime: (t: number) => void;
  onReplace: (id: string) => void;
  onRemove: (id: string) => void;
};

/**
 * Vertical day calendar showing only what's on your day: locked meetings, starred must-sees (★) and
 * your picks, each in its topic color. Click an empty time to see the options from then; click a talk to
 * see what you could switch to. The `ref` marks the time the side panel is showing options for, so the
 * page can scroll there.
 */
export const DayTimeline = forwardRef<HTMLDivElement, Props>(function DayTimeline(p, focusRef) {
  const t0 = dayStart(p.day);
  const t1 = dayEnd(p.day);
  const y = (t: number) => ((t - t0) / MIN) * PX_PER_MIN;
  const height = y(t1);
  const hours: number[] = [];
  for (let t = t0; t <= t1; t += 60 * MIN) hours.push(t);

  const sorted = [...p.sessions].sort((a, b) => ms(a.start) - ms(b.start));
  const hovered = p.options.find((o) => o.session.id === p.hoverId);
  const willReplace = new Set(hovered?.type === "swap" ? hovered.replaces : []);

  // time under the mouse, snapped to 5 minutes
  const [pointer, setPointer] = useState<number | null>(null);
  const timeAt = (e: React.MouseEvent<HTMLElement>) => {
    const minutes = (e.clientY - e.currentTarget.getBoundingClientRect().top) / PX_PER_MIN;
    return Math.min(t1, t0 + Math.max(0, Math.floor(minutes / 5) * 5) * MIN);
  };

  return (
    <div className="glass rounded-2xl">
      <div className="relative" style={{ height: height + 16 }}>
        <div className="absolute inset-x-0 top-2" style={{ height }}>
          {hours.map((h) => (
            <div key={h} className="absolute left-12 right-0 border-t border-dashed border-gray-200/70" style={{ top: y(h) }}>
              <span className="absolute -left-10 -top-2 text-[10px] text-gray-500">{fmtTime(h)}</span>
            </div>
          ))}

          {/* click anywhere that isn't a talk to see the options from that time */}
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={(e) => p.onPickTime(timeAt(e))}
            onMouseMove={(e) => setPointer(timeAt(e))}
            onMouseLeave={() => setPointer(null)}
          />
          {pointer !== null && (
            <div className="pointer-events-none absolute left-12 right-2 z-20 border-t-2 border-[var(--brand)]/50" style={{ top: y(pointer) }}>
              <span className="absolute -top-2.5 right-0 rounded-full bg-[var(--brand)] px-2 py-0.5 text-[10px] font-semibold text-white">{fmtTime(pointer)}</span>
            </div>
          )}

          {p.focus && <div ref={focusRef} className="pointer-events-none absolute left-0 h-0 w-0" style={{ top: y(p.focus.start) }} />}

          {p.blocks.map((b) => (
            <div key={b.id} className="hatched absolute left-12 right-2 overflow-hidden rounded-xl border border-gray-300 px-2 py-1 text-xs text-gray-700" style={{ top: y(ms(b.start)), height: Math.max(20, y(ms(b.end)) - y(ms(b.start))) }}>
              🔒 <b>{b.title}</b> · {fmtTime(b.start)}–{fmtTime(b.end)}
            </div>
          ))}

          {p.ghosts.map((s) => (
            <div
              key={`ghost-${s.id}`}
              className="pointer-events-none absolute left-12 overflow-hidden rounded-xl border border-dashed border-gray-400 bg-gray-50/80 px-2 py-0.5 text-[11px] text-gray-500"
              style={{ top: y(ms(s.start)) + 1, height: Math.max(20, y(ms(s.end)) - y(ms(s.start)) - 2), width: "22%" }}
              title={`Swapped out: ${s.title}`}
            >
              <div className="truncate line-through">{s.title}</div>
              <div className="text-[10px] no-underline">swapped out</div>
            </div>
          ))}

          {sorted.map((s, i) => {
            const anchor = p.anchorIds.includes(s.id);
            const color = topicColor(s);
            const prev = sorted[i - 1];
            const walk = prev ? travelMinutes(prev.roomId, s.roomId) : 0;
            const h = Math.max(22, y(ms(s.end)) - y(ms(s.start)) - 2);
            const doomed = willReplace.has(s.id);
            return (
              <div key={s.id}>
                {prev && walk > 0 && ms(s.start) - ms(prev.end) < 30 * MIN && (
                  <div className="absolute left-14 z-10 text-[10px] text-gray-500" style={{ top: y(ms(prev.end)) - 1 }}>
                    🚶 {walk} min
                  </div>
                )}
                <div
                  className={`group absolute right-2 overflow-hidden rounded-xl px-2.5 py-1 text-xs shadow-sm transition ${p.ghosts.length ? "left-[calc(22%+3.25rem)]" : "left-12"} ${p.replacingId === s.id ? "opacity-40" : ""} ${doomed ? "ring-2 ring-red-500 ring-offset-1" : ""}`}
                  style={{
                    top: y(ms(s.start)) + 1,
                    height: h,
                    background: doomed ? "#ffe0e6" : `${color}40`,
                    borderLeft: `5px solid ${doomed ? "#ff5470" : color}`,
                  }}
                >
                  <button className="block w-full text-left" onClick={() => p.onReplace(s.id)} title="Tap to see alternatives for this slot">
                    <div className={`truncate font-semibold text-[var(--ink)] ${doomed ? "line-through" : ""}`}>
                      {anchor && "★ "}
                      {s.title}
                    </div>
                    {h > 34 && (
                      <div className="truncate text-[var(--muted)]">
                        {doomed ? "↺ would be swapped out" : `${fmtTime(s.start)}–${fmtTime(s.end)} · ${roomById.get(s.roomId)?.name}`}
                      </div>
                    )}
                  </button>
                  <button className="absolute right-1 top-1 hidden rounded bg-white px-1.5 text-[10px] shadow group-hover:block" onClick={() => p.onRemove(s.id)} title="Remove from my day">
                    ✕
                  </button>
                </div>
              </div>
            );
          })}

          {hovered && !willReplace.size && (
            <div
              className="pointer-events-none absolute left-16 right-4 z-30 rounded-xl border-2 border-dashed bg-white/90 px-2 py-1 text-xs"
              style={{ top: y(ms(hovered.session.start)), height: Math.max(20, y(ms(hovered.session.end)) - y(ms(hovered.session.start))), borderColor: topicColor(hovered.session) }}
            >
              <b>{hovered.session.title}</b>
            </div>
          )}
          {hovered && willReplace.size > 0 && (
            <div
              className="pointer-events-none absolute left-1/3 right-4 z-30 rounded-xl border-2 border-dashed bg-white/90 px-2 py-1 text-xs"
              style={{ top: y(ms(hovered.session.start)), height: Math.max(20, y(ms(hovered.session.end)) - y(ms(hovered.session.start))), borderColor: topicColor(hovered.session) }}
            >
              <b>↺ {hovered.session.title}</b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
