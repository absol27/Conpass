"use client";
import { useState } from "react";
import type { Session } from "@/lib/types";
import type { Suggestion, Suggestions } from "@/lib/scheduler/recommend";
import { getSession, roomById } from "@/lib/data";
import { dayLabel, fmtTime, ms } from "@/lib/time";
import { Button, DemandBadge, TopicChip, topicColor } from "./ui";
import { Tag } from "./Tag";

export type BacktrackView = {
  steps: { picked: Session; displaced: Session[] }[];
  /** Swapped-out talks that repeat later and still fit. */
  repeats: { of: Session; repeat: Session }[];
};

type Props = {
  mode: "forward" | "gap" | "replace";
  focus: { start: number; end: number };
  /** Your pick right before this slot (the one "go back" options would replace). */
  prev: Session | null;
  replacing: Session | null;
  backtrack: BacktrackView | null;
  data: (Suggestions & { source?: string }) | null;
  loading: boolean;
  lunch: Session | null;
  onPick: (id: string) => void;
  onSkip: () => void;
  onFinish: () => void;
  onCancelReplace: () => void;
  onRemoveReplacing: () => void;
  onUndoLast: () => void;
  onUndoAll: () => void;
  onEndBacktrack: () => void;
  onAddRepeat: (id: string) => void;
  onHover: (id: string | null) => void;
};

const span = (s: Session) => `${fmtTime(s.start)}–${fmtTime(s.end)}`;
/** Start times shown before "Show later talks". */
const START_TIMES_SHOWN = 3;

/**
 * The options for the current slot. Small boxes on top: talks that start while your last pick is still
 * running ("go back": switch to one and fill the time before it). Below: the talks you can make next,
 * grouped by start time.
 */
export function OptionPanel(p: Props) {
  const gap = p.mode === "gap";
  const fits = p.data ? [...p.data.recommended, ...p.data.also] : [];
  const goBack = p.mode !== "replace" && p.prev ? p.data?.swaps ?? [] : [];

  return (
    <div className="space-y-4">
      {p.backtrack && <BacktrackTrail view={p.backtrack} active={gap} onUndoLast={p.onUndoLast} onUndoAll={p.onUndoAll} onEnd={p.onEndBacktrack} onAddRepeat={p.onAddRepeat} />}

      <div>
        <div className={`text-xs font-semibold uppercase tracking-wide ${gap ? "text-[var(--accent)]" : "text-[var(--brand)]"}`}>
          {gap ? "↩ Going back" : p.replacing ? "Alternatives for this slot" : p.prev ? "What's next" : "Start your day"}
        </div>
        <h2 className="text-lg font-bold">
          {gap ? `Fill ${fmtTime(p.focus.start)} – ${fmtTime(p.focus.end)}` : p.replacing ? span(p.replacing) : `From ${fmtTime(p.focus.start)}`}
        </h2>
        <p className="text-sm text-[var(--muted)]">
          {gap ? (
            <>You freed this time by switching. Pick a talk that fits, keep it free, or go back one more step. Nothing from {fmtTime(p.focus.end)} on will change.</>
          ) : p.replacing ? (
            <>
              Replacing <b>{p.replacing.title}</b>.{" "}
              <button className="underline" onClick={p.onCancelReplace}>Keep it</button> ·{" "}
              <button className="underline" onClick={p.onRemoveReplacing}>Remove it</button>
            </>
          ) : p.prev ? (
            <>After <b>{p.prev.title}</b>, walking time included.</>
          ) : (
            <>Pick your first session. It goes straight onto your schedule.</>
          )}
        </p>
      </div>

      {p.loading && (
        <div className="glass flex items-center gap-3 rounded-2xl p-4 text-sm text-[var(--muted)]">
          <Tag pose="walk" size={48} />
          Searching with Elasticsearch…
        </div>
      )}

      {!p.loading && p.data && (
        <>
          {goBack.length > 0 && p.prev && <GoBackRow prev={p.prev} items={goBack} onPick={p.onPick} onHover={p.onHover} />}

          {fits.length > 0 ? (
            <NextOptions items={fits} bestId={p.data.recommended[0]?.sessionId} switching={Boolean(p.replacing)} onPick={p.onPick} onHover={p.onHover} />
          ) : (
            <div className="glass flex items-center gap-3 rounded-2xl p-4 text-sm text-[var(--muted)]">
              <Tag pose="look" size={48} />
              {gap
                ? goBack.length
                  ? `Nothing fits exactly in ${fmtTime(p.focus.start)}–${fmtTime(p.focus.end)}. Go back another step above, or keep it free.`
                  : `Nothing fits in ${fmtTime(p.focus.start)}–${fmtTime(p.focus.end)}. Keep it free for the hallway track.`
                : "Nothing else fits here. Enjoy the hallway track!"}
            </div>
          )}

          {p.lunch && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-3">
              <div className="text-sm">
                <div className="font-semibold">🍽️ {p.lunch.title}</div>
                <div className="text-xs text-teal-800">{span(p.lunch)} · {roomById.get(p.lunch.roomId)?.name}</div>
              </div>
              <Button variant="secondary" onClick={() => p.onPick(p.lunch!.id)}>Add lunch</Button>
            </div>
          )}
          {p.data.source === "local" && <p className="text-xs text-amber-700">Elasticsearch unavailable, using local ranking.</p>}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {gap ? (
          <Button variant="secondary" onClick={p.onSkip}>Keep {fmtTime(p.focus.start)}–{fmtTime(p.focus.end)} free</Button>
        ) : (
          !p.replacing && <Button variant="secondary" onClick={p.onSkip}>Leave this time free</Button>
        )}
        {!gap && <Button variant="ghost" onClick={p.onFinish}>I&apos;m done for today</Button>}
      </div>
    </div>
  );
}

/** Small boxes: talks that start while your last pick is running. Choosing one replaces that pick. */
function GoBackRow({ prev, items, onPick, onHover }: { prev: Session; items: Suggestion[]; onPick: (id: string) => void; onHover: (id: string | null) => void }) {
  const sorted = [...items].sort((a, b) => ms(getSession(a.sessionId)!.start) - ms(getSession(b.sessionId)!.start));
  return (
    <div className="glass rounded-2xl border border-dashed border-[var(--accent)]/40 p-3">
      <div className="text-xs font-semibold text-[var(--accent)]">↩ Also starting during {span(prev)}</div>
      <p className="text-[11px] text-[var(--muted)]">
        Like one of these more? Switch to it: <b>{prev.title}</b> comes off your day and you can fill the time before it.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {sorted.map((s) => {
          const ses = getSession(s.sessionId)!;
          return (
            <button
              key={s.sessionId}
              onClick={() => onPick(s.sessionId)}
              onMouseEnter={() => onHover(s.sessionId)}
              onMouseLeave={() => onHover(null)}
              className="glass rounded-lg px-2 py-1.5 text-left text-[11px] leading-snug transition hover:bg-white/80"
              style={{ borderLeft: `3px solid ${topicColor(ses)}` }}
              title={`${ses.title} · ${span(ses)} · ${roomById.get(ses.roomId)?.name}`}
            >
              <span className="font-semibold text-[var(--muted)]">{fmtTime(ses.start)}</span>{" "}
              <span className="line-clamp-2 text-[var(--ink)]">{ses.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The talks you can make next, grouped by start time (earliest first). */
function NextOptions({ items, bestId, switching, onPick, onHover }: { items: Suggestion[]; bestId?: string; switching: boolean; onPick: (id: string) => void; onHover: (id: string | null) => void }) {
  const [showAll, setShowAll] = useState(false);
  const groups = new Map<number, Suggestion[]>();
  for (const s of [...items].sort((a, b) => b.score - a.score)) {
    const t = ms(getSession(s.sessionId)!.start);
    groups.set(t, [...(groups.get(t) ?? []), s]);
  }
  const sorted = [...groups.entries()].sort((a, b) => a[0] - b[0]);
  const shown = showAll ? sorted : sorted.slice(0, START_TIMES_SHOWN);
  return (
    <div className="space-y-3">
      {shown.map(([start, list]) => (
        <div key={start}>
          <div className="mb-1.5 text-xs font-bold text-[var(--brand)]">{fmtTime(start)}</div>
          <div className="space-y-2">
            {list.map((s) => <OptionCard key={s.sessionId} s={s} best={s.sessionId === bestId} switching={switching} onPick={onPick} onHover={onHover} />)}
          </div>
        </div>
      ))}
      {sorted.length > shown.length && (
        <button className="text-xs font-semibold text-[var(--brand)] underline" onClick={() => setShowAll(true)}>
          Show later talks ({sorted.length - shown.length} more start time{sorted.length - shown.length === 1 ? "" : "s"})
        </button>
      )}
    </div>
  );
}

/** `switching`: the slot already has a talk, so picking this one replaces it ("Switch" instead of "+ Add"). */
function OptionCard({ s, best, switching, onPick, onHover }: { s: Suggestion; best: boolean; switching: boolean; onPick: (id: string) => void; onHover: (id: string | null) => void }) {
  const ses = getSession(s.sessionId)!;
  const color = topicColor(ses);
  const why = s.reasons.filter((r) => !r.endsWith("min walk")).slice(0, 2);
  return (
    <button
      onClick={() => onPick(s.sessionId)}
      onMouseEnter={() => onHover(s.sessionId)}
      onMouseLeave={() => onHover(null)}
      className="glass group block w-full rounded-2xl p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/75"
      style={{ borderLeft: `5px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {best && <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">★ Best match for you</div>}
          <div className="font-semibold leading-snug text-[var(--ink)]">{ses.title}</div>
          <div className="text-xs text-[var(--muted)]">
            {span(ses)} · {roomById.get(ses.roomId)?.name}
            {s.walkMinutes > 0 && <> · 🚶 {s.walkMinutes} min</>}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--lead)] px-2.5 py-1 text-xs font-bold text-[var(--ink)] transition group-hover:brightness-95">{switching ? "↺ Switch" : "+ Add"}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {ses.topics.slice(0, 2).map((t) => <TopicChip key={t} id={t} />)}
        <DemandBadge demand={s.demand} />
        {ses.kind === "workshop" && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">Hands-on</span>}
      </div>
      {why.length > 0 && <div className="mt-1.5 text-[11px] text-[var(--muted)]">{why.join(" · ")}</div>}
    </button>
  );
}

function BacktrackTrail({ view, active, onUndoLast, onUndoAll, onEnd, onAddRepeat }: { view: BacktrackView; active: boolean; onUndoLast: () => void; onUndoAll: () => void; onEnd: () => void; onAddRepeat: (id: string) => void }) {
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <Tag pose={active ? "oops" : "cheer"} size={44} />
        <div className="flex-1 font-semibold text-amber-900">
          {active ? "Your changes so far" : `Done: ${view.steps.length} change${view.steps.length === 1 ? "" : "s"}, the rest of your day is untouched`}
        </div>
        {!active && <button className="text-xs text-amber-800 underline" onClick={onEnd}>Hide</button>}
      </div>
      <ol className="mt-2 space-y-1.5">
        {view.steps.map((st, i) => (
          <li key={i} className="flex gap-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-200 text-[11px] font-bold text-amber-900">{i + 1}</span>
            <span>
              {st.displaced.length ? (
                <>
                  <span className="text-gray-500 line-through">{st.displaced.map((d) => `${d.title} (${span(d)})`).join(", ")}</span>
                  <span className="mx-1">→</span>
                </>
              ) : (
                <span className="text-gray-500">Filled with </span>
              )}
              <b>{st.picked.title}</b> <span className="text-xs text-gray-600">({span(st.picked)})</span>
            </span>
          </li>
        ))}
      </ol>
      {view.repeats.map(({ of, repeat }) => (
        <div key={repeat.id} className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-xs">
          <span>↻ <b>{of.title}</b> repeats {dayLabel(repeat.day)} {fmtTime(repeat.start)}</span>
          <button className="shrink-0 font-semibold text-[var(--brand)] underline" onClick={() => onAddRepeat(repeat.id)}>Add it there</button>
        </div>
      ))}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onUndoLast} className="!px-3 !py-1.5 text-xs">↶ Undo last change</Button>
        <Button variant="secondary" onClick={onUndoAll} className="!px-3 !py-1.5 text-xs">Restore my original plan</Button>
        {active && <Button variant="ghost" onClick={onEnd} className="!px-3 !py-1.5 text-xs">Stop backtracking</Button>}
      </div>
    </div>
  );
}
