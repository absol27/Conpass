import type { Interests, Session } from "../types";
import { topicById } from "../data";
import { MIN, ms } from "../time";
import { travelMinutes } from "../venue";
import { conflictsWith, lateBy, LATE_TOLERANCE_MIN, sessionSlot, slotBefore, type Slot, type Window } from "./feasibility";

/** How far past the window start we look for the "next" talk. */
export const HORIZON_MIN = 120;
/** Recommendations must start within this many minutes of the window start. */
export const NEXT_WITHIN_MIN = 45;

export type RecommendInput = {
  day: number;
  window: { start: number; end: number };
  interests: Interests;
  favoriteSpeakers: string[];
  /** Sessions already picked; the most recent one drives "more like this". */
  likeIds: string[];
  excludeIds: string[];
  /** Start of the pick right before the slot: talks starting during it are fetched too ("go back" options). */
  backFrom?: number;
};

/** Earliest start time to fetch: a little before the slot, or back to the start of the pick before it. */
const fetchFrom = (input: RecommendInput) => Math.min(input.window.start - 45 * MIN, input.backFrom ?? Infinity);

/**
 * Elasticsearch query: filter to sessions around the free window, then score by
 * interests (per-topic boosts), similarity to the last talk (more_like_this),
 * favorite speakers, and closeness to the window start (gauss decay).
 * Named queries (_name) come back as matched_queries so we can explain "why".
 */
export function buildRecommendQuery(input: RecommendInput, index = "sessions") {
  const from = new Date(fetchFrom(input)).toISOString();
  const to = new Date(Math.min(input.window.end, input.window.start + HORIZON_MIN * MIN)).toISOString();
  const should: object[] = [
    ...Object.entries(input.interests).map(([topic, w]) => ({
      term: { topics: { value: topic, boost: 2 * w, _name: `topic:${topic}` } },
    })),
    ...input.favoriteSpeakers.map((name) => ({
      match_phrase: { "speakers.name": { query: name, boost: 4, _name: `speaker:${name}` } },
    })),
    { match_all: { boost: 0.2 } },
  ];
  if (input.likeIds.length) {
    should.push({
      more_like_this: {
        fields: ["title", "keywords"],
        like: input.likeIds.slice(-2).map((id) => ({ _index: index, _id: id })),
        min_term_freq: 1,
        min_doc_freq: 1,
        max_query_terms: 30,
        minimum_should_match: "20%",
        boost: 1.5,
        _name: "mlt",
      },
    });
  }
  return {
    size: 100,
    query: {
      function_score: {
        query: {
          bool: {
            filter: [
              { term: { day: input.day } },
              { terms: { kind: ["talk", "workshop", "keynote"] } },
              { range: { start: { gte: from, lte: to } } },
            ],
            must_not: [{ ids: { values: input.excludeIds } }],
            should,
          },
        },
        functions: [
          { gauss: { start: { origin: new Date(input.window.start).toISOString(), scale: "25m", offset: "5m", decay: 0.5 } } },
        ],
        boost_mode: "multiply",
      },
    },
  };
}

export type Candidate = { session: Session; score: number; matched: string[] };

export type Suggestion = {
  sessionId: string;
  score: number;
  reasons: string[];
  walkMinutes: number;
  lateBy: number;
  /** The earlier pick this would replace ("go back" options only). */
  replaces: string[];
  /** Locked personal block it overlaps (blocked options only). */
  blockedBy?: string;
  demand?: number;
};

/**
 * recommended: top 3 that fit with no changes · also: everything else that fits ·
 * swaps: "go back" options, talks that start while the pick right before the slot is still running and
 * replace only that pick · blocked: overlap a locked personal block.
 */
export type Suggestions = { recommended: Suggestion[]; also: Suggestion[]; swaps: Suggestion[]; blocked: Suggestion[] };

/** How well a session matches your interests (sum of topic weights). */
export function interestScore(s: Session, interests: Interests) {
  return s.topics.reduce((sum, t) => sum + (interests[t] ?? 0), 0);
}

/** Simple keyword overlap between two sessions (0..1). Used when ES is unavailable. */
export function keywordSimilarity(a: Session, b: Session): number {
  const words = (s: Session) => new Set(`${s.keywords} ${s.title}`.toLowerCase().split(/[^a-z0-9-]+/).filter((w) => w.length > 2));
  const wa = words(a), wb = words(b);
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  const topicShared = a.topics.filter((t) => b.topics.includes(t)).length;
  return Math.min(1, shared / Math.max(4, Math.min(wa.size, wb.size)) + 0.25 * topicShared);
}

/** Local scoring that mirrors the ES query; used as a fallback so the demo never breaks. */
export function localCandidates(all: Session[], input: RecommendInput): Candidate[] {
  const from = fetchFrom(input);
  const to = Math.min(input.window.end, input.window.start + HORIZON_MIN * MIN);
  const like = input.likeIds.slice(-2).map((id) => all.find((s) => s.id === id)).filter(Boolean) as Session[];
  return all
    .filter((s) => s.day === input.day && s.kind !== "activity" && !input.excludeIds.includes(s.id))
    .filter((s) => ms(s.start) >= from && ms(s.start) <= to)
    .map((s) => {
      const matched: string[] = [];
      let score = 0.2;
      for (const t of s.topics) if (input.interests[t]) { score += 2 * input.interests[t]; matched.push(`topic:${t}`); }
      for (const name of input.favoriteSpeakers) if (s.speakers.some((p) => p.name.toLowerCase() === name.toLowerCase())) { score += 4; matched.push(`speaker:${name}`); }
      const sim = Math.max(0, ...like.map((l) => keywordSimilarity(l, s)));
      if (sim > 0.3) { score += 1.5 * sim * 3; matched.push("mlt"); }
      const gap = Math.max(0, (ms(s.start) - input.window.start) / MIN - 5);
      score *= Math.pow(0.5, (gap / 25) ** 2);
      return { session: s, score, matched };
    });
}

/**
 * Re-rank ES candidates against the actual timeline: drop what you can't reach,
 * penalise idle gaps / late arrival / likely-full rooms, and sort every option into
 * fits / go back (swaps) / blocked.
 *
 * Going back only ever changes the past, one step at a time: a "go back" option starts while the pick
 * right before the slot is still running and replaces that pick alone. Anything else that clashes
 * (later picks, starred must-sees, a protected pick) is left out.
 */
export function rankCandidates(
  candidates: Candidate[],
  ctx: {
    slots: Slot[];
    window: Window;
    prev?: Slot;
    demand?: Record<string, number>;
    prevTitle?: string;
    /** Picks that must never be swapped out: starred must-sees and anything at or after the slot. */
    protectedIds?: Set<string>;
  },
): Suggestions {
  const maxScore = Math.max(1e-6, ...candidates.map((c) => c.score));
  const out: Suggestions = { recommended: [], also: [], swaps: [], blocked: [] };
  const fitting: Suggestion[] = [];
  const before = ctx.prev ?? slotBefore(ctx.slots, ctx.window.start + MIN);
  const canGoBack = before && !before.locked && !ctx.protectedIds?.has(before.id);

  for (const c of candidates) {
    const slot = sessionSlot(c.session);
    const conflicts = conflictsWith(ctx.slots, slot);
    const startsIn = (slot.start - ctx.window.start) / MIN;
    const walk = ctx.prev && !conflicts.some((x) => x.id === ctx.prev!.id) ? travelMinutes(ctx.prev.roomId, slot.roomId) : 0;
    const late = ctx.prev && !conflicts.length ? Math.max(0, lateBy(ctx.prev, slot)) : 0;
    const demand = ctx.demand?.[c.session.id];

    let score = (c.score / maxScore) * 10;
    score -= Math.max(0, startsIn) * 0.03;
    score -= late * 0.4;
    if (demand && demand > 1) score -= 1.5;

    const reasons: string[] = [];
    for (const m of c.matched) {
      if (m.startsWith("topic:")) reasons.push(`Matches ${topicById.get(m.slice(6))?.label ?? m.slice(6)}`);
      else if (m.startsWith("speaker:")) reasons.push(`You follow ${m.slice(8)}`);
      else if (m === "mlt") reasons.push(ctx.prevTitle ? `Similar to "${ctx.prevTitle}"` : "Similar to your picks");
    }
    if (walk) reasons.push(`${walk} min walk`);
    if (late > 0 && late <= LATE_TOLERANCE_MIN) reasons.push(`You'd arrive ~${late} min late`);
    if (demand && demand > 0.9) reasons.push("Likely to fill up — arrive early");

    const sug: Suggestion = {
      sessionId: c.session.id,
      score: Math.round(score * 100) / 100,
      reasons,
      walkMinutes: walk,
      lateBy: late,
      replaces: [],
      demand,
    };
    if (!conflicts.length) {
      if (slot.start >= ctx.window.start - LATE_TOLERANCE_MIN * MIN && slot.end <= ctx.window.end + LATE_TOLERANCE_MIN * MIN) {
        fitting.push({ ...sug, score: startsIn <= NEXT_WITHIN_MIN ? sug.score : sug.score - 3 });
      }
      continue;
    }
    const locked = conflicts.find((x) => x.locked);
    if (locked) {
      out.blocked.push({ ...sug, blockedBy: locked.title });
      continue;
    }
    const startsDuringBefore = canGoBack && slot.start > before.start && slot.start < before.end;
    if (startsDuringBefore && conflicts.length === 1 && conflicts[0].id === before.id) {
      out.swaps.push({ ...sug, replaces: [before.id] });
    }
  }

  fitting.sort((a, b) => b.score - a.score);
  out.recommended = fitting.slice(0, 3);
  out.also = fitting.slice(3);
  out.swaps = out.swaps.sort((a, b) => b.score - a.score).slice(0, MAX_GO_BACK);
  out.blocked = out.blocked.slice(0, 4);
  return out;
}

/** Keep the "go back" row small: the best few talks starting during your last pick. */
export const MAX_GO_BACK = 6;
