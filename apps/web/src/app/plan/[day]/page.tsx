"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { conference, getSession, sessions } from "@/lib/data";
import { planIds, useStore } from "@/lib/store";
import { api, useHydrated } from "@/lib/client";
import { dayEnd, dayLabel, dayStart, MIN, ms } from "@/lib/time";
import { travelMinutes } from "@/lib/venue";
import { blockSlot, freeWindows, sessionSlot, type Window } from "@/lib/scheduler/feasibility";
import type { Suggestions } from "@/lib/scheduler/recommend";
import { leftoverGaps, placeWithSwap, repeatThatFits } from "@/lib/scheduler/backtrack";
import type { Session } from "@/lib/types";
import { DayTimeline, type TimelineOption } from "@/components/DayTimeline";
import { OptionPanel, type BacktrackView } from "@/components/OptionPanel";
import { ExportMenu } from "@/components/ExportMenu";
import { Button, Modal } from "@/components/ui";
import { Tag } from "@/components/Tag";

type Mode = "forward" | "gap" | "replace";
type Focus = { start: number; end: number; replacingId: string | null; mode: Mode };
type Gap = { start: number; end: number };

/**
 * Backtracking state for one chain of swaps. `gaps[0]` is the freed time being filled now.
 * `undo` holds the plan before each step so every change can be reversed.
 */
type Backtrack = {
  basePlan: string[];
  baseCursor: number | null;
  steps: { pickedId: string; displaced: string[] }[];
  gaps: Gap[];
  undo: { plan: string[]; gaps: Gap[] }[];
};

const byId = (id: string) => getSession(id)!;
const toGap = (w: Window | null): Gap | null => (w ? { start: w.start, end: w.end } : null);

/** First moment a talk could start inside the window (so we don't focus on empty breakfast time). */
function firstStartIn(day: number, w: { start: number; end: number }, taken: Set<string>): number | null {
  const starts = sessions
    .filter((s) => s.day === day && s.kind !== "activity" && !taken.has(s.id))
    .filter((s) => ms(s.start) >= w.start - 5 * MIN && ms(s.start) <= w.end - 15 * MIN && ms(s.end) <= w.end + 5 * MIN)
    .map((s) => ms(s.start));
  return starts.length ? Math.max(w.start, Math.min(...starts)) : null;
}

/** When the day's first session starts (freed time before it isn't worth showing). */
const firstSessionStart = (day: number) => Math.min(...sessions.filter((s) => s.day === day && s.kind !== "activity").map((s) => ms(s.start)));

/** Screen 3: build one day, one pick at a time. */
export default function PlanDay() {
  const hydrated = useHydrated();
  const day = Number(useParams<{ day: string }>().day) || 1;
  const router = useRouter();

  const profile = useStore((s) => s.profile);
  const blocks = useStore((s) => s.blocks);
  const plans = useStore((s) => s.plans);
  const { initDay, applyPlans, removeSession, setCursor, setDone, resetDay } = useStore.getState();
  const plan = plans[day];

  useEffect(() => {
    if (hydrated) initDay(day);
  }, [hydrated, day, initDay]);

  const daySessions = useMemo(() => (plan?.sessionIds ?? []).map((id) => getSession(id)!).filter(Boolean), [plan?.sessionIds]);
  const dayBlocks = useMemo(() => blocks.filter((b) => b.day === day), [blocks, day]);

  const [override, setOverride] = useState<Focus | null>(null);
  const [bt, setBt] = useState<Backtrack | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok?: boolean } | null>(null);
  useEffect(() => { setBt(null); setOverride(null); }, [day]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const slots = useMemo(() => [...daySessions.map(sessionSlot), ...dayBlocks.map(blockSlot)], [daySessions, dayBlocks]);
  const taken = useMemo(() => new Set(Object.values(plans).flatMap((p) => p.sessionIds)), [plans]);

  // Windows that actually have something to pick.
  const windows = useMemo(
    () => freeWindows(slots, dayStart(day), dayEnd(day)).filter((w) => firstStartIn(day, w, taken) !== null),
    [slots, day, taken],
  );

  const focus: Focus | null = useMemo(() => {
    if (bt?.gaps.length) return { start: Math.max(bt.gaps[0].start, firstSessionStart(day)), end: bt.gaps[0].end, replacingId: null, mode: "gap" };
    if (override) return override;
    const cursor = plan?.cursor ?? dayStart(day);
    for (const w of windows) {
      if (w.end <= cursor + 15 * MIN) continue;
      const clipped = { start: Math.max(w.start, cursor), end: w.end };
      const first = firstStartIn(day, clipped, taken);
      if (first !== null) return { start: first, end: w.end, replacingId: null, mode: "forward" };
    }
    return null;
  }, [bt, override, plan?.cursor, windows, day, taken]);

  // --- options from Elasticsearch ---
  const [data, setData] = useState<(Suggestions & { source?: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  const focusKey = focus ? `${focus.mode}-${focus.start}-${focus.end}-${focus.replacingId}` : "none";
  const lastDisplaced = bt?.steps.at(-1)?.displaced ?? [];
  useEffect(() => {
    if (!focus || !plan) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    const planForQuery = plan.sessionIds.filter((id) => id !== focus.replacingId);
    api<Suggestions & { source: string }>("/api/recommend", {
      day,
      window: { start: focus.start, end: focus.end },
      interests: profile.interests,
      favoriteSpeakers: profile.favoriteSpeakers,
      plan: planForQuery,
      taken: [...taken], // includes the talk being replaced, so it is not offered as its own alternative
      blocks,
      likeIds: focus.mode === "gap" ? lastDisplaced : undefined,
      protect: plan.anchorIds,
    })
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, plan?.sessionIds.join(","), blocks.length]);

  // --- picking: swap + backtrack ---
  const pick = (id: string) => {
    if (!focus || !plan) return;
    const x = byId(id);
    const current = plan.sessionIds;
    const r = placeWithSwap(day, current, blocks, id, byId, focus.replacingId ? [focus.replacingId] : []);
    if (r.status === "blocked") {
      setNotice({ text: `"${x.title}" overlaps your locked "${r.blockedBy.title}". Personal commitments never move.` });
      return;
    }
    setNotice(null);
    applyPlans({ [day]: r.plan });

    if (focus.mode === "gap" && bt) {
      // Backtracking: the time freed before this pick (if any) is next, then whatever is left of the current gap.
      const gap = bt.gaps[0];
      const left = leftoverGaps(day, r.plan, blocks, x, gap, byId);
      const before = toGap(r.gapBefore) ?? toGap(left.before);
      const next = [before, toGap(left.after)].filter(Boolean) as Gap[];
      setBt({
        ...bt,
        steps: [...bt.steps, { pickedId: id, displaced: r.displaced }],
        gaps: [...next, ...bt.gaps.slice(1)],
        undo: [...bt.undo, { plan: current, gaps: bt.gaps }],
      });
      return;
    }

    setOverride(null);
    if (focus.mode === "forward") {
      const later = r.plan.some((pid) => pid !== id && ms(byId(pid).start) >= ms(x.end));
      setCursor(day, later ? Math.max(plan.cursor ?? 0, ms(x.end)) : ms(x.end));
    }
    if (r.displaced.length) {
      // A swap starts a backtrack chain: first fill what it freed before the new talk, then after it.
      const gaps = [toGap(r.gapBefore), toGap(r.gapAfter)].filter(Boolean) as Gap[];
      setBt({ basePlan: current, baseCursor: plan.cursor, steps: [{ pickedId: id, displaced: r.displaced }], gaps, undo: [{ plan: current, gaps: [] }] });
    } else {
      setBt(null);
    }
  };

  const undoLast = () => {
    if (!bt) return;
    const u = bt.undo.at(-1)!;
    applyPlans({ [day]: u.plan });
    if (bt.undo.length === 1) {
      setCursor(day, bt.baseCursor);
      setBt(null);
    } else {
      setBt({ ...bt, steps: bt.steps.slice(0, -1), gaps: u.gaps, undo: bt.undo.slice(0, -1) });
    }
  };
  const undoAll = () => {
    if (!bt) return;
    applyPlans({ [day]: bt.basePlan });
    setCursor(day, bt.baseCursor);
    setBt(null);
  };
  const addRepeat = (id: string) => {
    const s = byId(id);
    applyPlans({ [s.day]: [...(plans[s.day]?.sessionIds ?? []), id] });
    setNotice({ text: `Added "${s.title}" on ${dayLabel(s.day)}.`, ok: true });
  };

  const skip = () => {
    if (!focus) return;
    if (focus.mode === "gap" && bt) {
      setBt({ ...bt, gaps: bt.gaps.slice(1) });
      return;
    }
    const all = [...(data?.recommended ?? []), ...(data?.also ?? [])].map((s) => ms(byId(s.sessionId).end));
    setCursor(day, all.length ? Math.min(...all) : focus.end);
    setOverride(null);
  };

  /** Tapped a talk on the timeline: show what you could switch to in its slot. */
  const openReplace = (id: string) => {
    const s = getSession(id)!;
    const without = slots.filter((x) => x.id !== id);
    const w = freeWindows(without, dayStart(day), dayEnd(day)).find((x) => x.start <= ms(s.start) && x.end >= ms(s.end));
    setBt(null);
    if (w) setOverride({ start: Math.max(w.start, ms(s.start) - 30 * MIN), end: w.end, replacingId: id, mode: "replace" });
  };

  /** Clicked a time on the timeline: a talk there gives switch options; free time gives the options from then. */
  const pickTime = (t: number) => {
    const there = daySessions.find((s) => ms(s.start) <= t && t < ms(s.end));
    if (there) return openReplace(there.id);
    const w = freeWindows(slots, dayStart(day), dayEnd(day), 1).find((x) => x.start <= t && t < x.end);
    if (!w) return; // inside a locked meeting
    setBt(null);
    setOverride({ start: t, end: w.end, replacingId: null, mode: "forward" });
  };

  const [showDone, setShowDone] = useState(false);
  const finish = () => {
    setDone(day, true);
    setShowDone(true);
  };

  // Day complete: no more windows to fill.
  const doneShownFor = useRef<number | null>(null);
  useEffect(() => {
    if (hydrated && plan && !focus && !plan.done && doneShownFor.current !== day) {
      doneShownFor.current = day;
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, plan, focus, day]);

  // Keep the time the panel is showing options for in view on the timeline, and show the panel from the top.
  const focusRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    panelRef.current?.scrollTo({ top: 0 });
  }, [focusKey]);

  const [hover, setHover] = useState<string | null>(null);

  if (!hydrated || !plan) return null;

  const prev = focus ? [...daySessions].filter((s) => s.id !== focus.replacingId && ms(s.end) <= focus.start + MIN).sort((a, b) => ms(b.end) - ms(a.end))[0] ?? null : null;
  const replacing = focus?.replacingId ? getSession(focus.replacingId)! : null;
  const lunch = focus && focus.mode === "forward" && profile.lunchOptIn ? lunchFor(day, focus, profile.lunchTheme ?? Object.keys(profile.interests)[0], taken) : null;
  const walking = walkingMinutes(daySessions);
  const nextDay = conference.days.find((d) => d.day === day + 1);

  // Hovering an option in the panel previews it on the timeline.
  const options: TimelineOption[] = data
    ? [
        ...[...data.recommended, ...data.also].map((s) => ({ session: byId(s.sessionId), type: "fit" as const, replaces: [] })),
        ...data.swaps.map((s) => ({ session: byId(s.sessionId), type: "swap" as const, replaces: s.replaces })),
      ]
    : [];
  const ghosts = bt ? bt.steps.flatMap((s) => s.displaced).filter((id) => !plan.sessionIds.includes(id)).map(byId) : [];
  const btView: BacktrackView | null = bt
    ? {
        steps: bt.steps.map((s) => ({ picked: byId(s.pickedId), displaced: s.displaced.map(byId) })),
        repeats: ghosts.flatMap((g) => {
          const repeat = repeatThatFits(g, planIds(plans), blocks, sessions);
          return repeat ? [{ of: g, repeat }] : [];
        }),
      }
    : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="glass flex rounded-xl p-1">
          {conference.days.map((d) => (
            <Link key={d.day} href={`/plan/${d.day}`} className={`rounded-lg px-3 py-1.5 text-sm ${d.day === day ? "bg-[var(--brand)] text-white" : "text-[var(--muted)]"}`}>
              {d.label}
              {plans[d.day]?.done && " ✓"}
            </Link>
          ))}
        </div>
        <div className="text-sm text-[var(--muted)]">
          {daySessions.filter((s) => s.kind !== "activity").length} talks · 🚶 {walking} min walking
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => { resetDay(day); initDay(day); setOverride(null); setBt(null); doneShownFor.current = null; }}>Start over</Button>
          <ExportMenu day={day} />
        </div>
      </div>

      {notice && (
        <div className={`mb-3 flex items-center gap-3 rounded-xl border ${notice.ok ? "border-teal-200" : "border-red-200"} bg-white px-4 py-2 text-sm shadow-sm`}>
          <Tag pose={notice.ok ? "cheer" : "oops"} size={40} />
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(420px,520px)_1fr]">
        <DayTimeline
          ref={focusRef}
          day={day}
          sessions={daySessions}
          anchorIds={plan.anchorIds}
          blocks={dayBlocks}
          focus={focus}
          replacingId={focus?.replacingId ?? null}
          ghosts={ghosts}
          options={options}
          hoverId={hover}
          onPickTime={pickTime}
          onReplace={openReplace}
          onRemove={(id) => { removeSession(day, id); setOverride(null); setBt(null); }}
        />

        {/* pinned on wide screens with its own scroll, so the options and the calendar scroll separately */}
        <div ref={panelRef} className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pb-4 lg:pr-1">
          {focus ? (
            <OptionPanel
              mode={focus.mode}
              focus={focus}
              prev={prev}
              replacing={replacing}
              backtrack={btView}
              data={data}
              loading={loading}
              lunch={lunch}
              onPick={pick}
              onSkip={skip}
              onFinish={finish}
              onCancelReplace={() => setOverride(null)}
              onRemoveReplacing={() => { if (focus.replacingId) removeSession(day, focus.replacingId); setOverride(null); }}
              onUndoLast={undoLast}
              onUndoAll={undoAll}
              onEndBacktrack={() => setBt(null)}
              onAddRepeat={addRepeat}
              onHover={setHover}
            />
          ) : (
            <div className="glass rounded-2xl p-6">
              <Tag pose="cheer" size={88} />
              <h2 className="mt-2 text-lg font-bold">{dayLabel(day)} is planned</h2>
              <p className="text-sm text-[var(--muted)]">Tap any talk on the timeline to see alternatives, or any gap to fill it.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {nextDay && <Button onClick={() => router.push(`/plan/${nextDay.day}`)}>Plan {nextDay.label} →</Button>}
                <Link href="/live"><Button variant="secondary">Go to live mode</Button></Link>
              </div>
            </div>
          )}
          {plan.anchorIds.length > 0 && (
            <p className="mt-4 text-xs text-[var(--muted)]">★ Talks you starred are placed for you and never swapped out. Hover one and tap ✕ to remove it.</p>
          )}
        </div>
      </div>

      {showDone && (
        <Modal onClose={() => setShowDone(false)}>
          <Tag pose="cheer" size={110} className="mx-auto block" />
          <h2 className="mt-2 text-xl font-bold">{dayLabel(day)} is ready</h2>
          <p className="text-sm text-[var(--muted)]">
            {daySessions.filter((s) => s.kind !== "activity").length} sessions, {walking} minutes of walking, {dayBlocks.length} personal commitment{dayBlocks.length === 1 ? "" : "s"} protected.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {nextDay && (
              <Button onClick={() => { setShowDone(false); router.push(`/plan/${nextDay.day}`); }}>Build {nextDay.label} now →</Button>
            )}
            <Button variant="secondary" onClick={() => setShowDone(false)}>Save &amp; finish later</Button>
            <div className="flex justify-center pt-1"><ExportMenu /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function walkingMinutes(list: Session[]) {
  const sorted = [...list].sort((a, b) => ms(a.start) - ms(b.start));
  return sorted.slice(1).reduce((sum, s, i) => sum + travelMinutes(sorted[i].roomId, s.roomId), 0);
}

function lunchFor(day: number, w: { start: number; end: number }, theme: string | undefined, taken: Set<string>): Session | null {
  if (!theme) return null;
  const l = sessions.find((s) => s.day === day && s.activityType === "lunch" && s.topics.includes(theme));
  if (!l || taken.has(l.id)) return null;
  const overlaps = ms(l.start) < w.end && ms(l.end) > w.start;
  const alreadyLunch = [...taken].some((id) => getSession(id)?.day === day && getSession(id)?.activityType === "lunch");
  return overlaps && !alreadyLunch && w.start <= ms(l.start) + 15 * MIN ? l : null;
}
