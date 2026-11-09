"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { Attendee, Block, DayPlan, PersonNote, Profile } from "./types";
import { conference, getSession, sessions } from "./data";
import { clashes, fits, sessionSlot, blockSlot } from "./scheduler/feasibility";
import { ms } from "./time";

const emptyPlan = (): DayPlan => ({ sessionIds: [], anchorIds: [], cursor: null, done: false });

const newProfile = (): Profile => ({
  userId: `u-${nanoid(10)}`,
  name: "",
  linkedin: "",
  role: "",
  company: "",
  interests: {},
  favoriteSessionIds: [],
  favoriteSpeakers: [],
  lunchOptIn: true,
  lunchTheme: null,
  shareScope: "day",
  shareFields: { name: true, linkedin: true, role: true, company: true },
  shareToken: `s-${nanoid(12)}`,
  contactToken: `c-${nanoid(12)}`,
});

type State = {
  profile: Profile;
  blocks: Block[];
  plans: Record<number, DayPlan>;
  onboarded: boolean;
  /** Demo clock: a fixed "now" (epoch ms) for live mode, or null for the real time. */
  demoNow: number | null;
  /**
   * Private notes about people you met, by their userId. Kept in this browser only: `toAttendee`
   * leaves them out, so they're never synced to Elasticsearch where others could read them.
   */
  notes: Record<string, PersonNote>;

  updateProfile: (p: Partial<Profile>) => void;
  setInterest: (topic: string, weight: number) => void;
  toggleFavoriteSession: (id: string) => void;
  toggleFavoriteSpeaker: (name: string) => void;
  setBlocks: (blocks: Block[]) => void;
  removeBlock: (id: string) => void;
  setOnboarded: (v: boolean) => void;
  /**
   * Start a day, or bring it up to date with the questionnaire: starred talks (and followed speakers'
   * talks) are placed as must-sees, and must-sees you un-starred come off again.
   */
  initDay: (day: number) => void;
  /** Apply plans returned by the scheduler (all days, since encores can move talks across days). */
  applyPlans: (plans: Record<number, string[]>, cursor?: { day: number; at: number }) => void;
  removeSession: (day: number, id: string) => void;
  setCursor: (day: number, at: number | null) => void;
  setDone: (day: number, done: boolean) => void;
  resetDay: (day: number) => void;
  setDemoNow: (t: number | null) => void;
  /** Save (or, when empty, delete) your note about someone you met. */
  setNote: (userId: string, text: string) => void;
  resetAll: () => void;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      profile: newProfile(),
      blocks: [],
      plans: {},
      onboarded: false,
      demoNow: null,
      notes: {},

      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      setInterest: (topic, weight) =>
        set((s) => {
          const interests = { ...s.profile.interests };
          if (weight > 0) interests[topic] = weight;
          else delete interests[topic];
          return { profile: { ...s.profile, interests } };
        }),
      toggleFavoriteSession: (id) =>
        set((s) => {
          const f = s.profile.favoriteSessionIds;
          return { profile: { ...s.profile, favoriteSessionIds: f.includes(id) ? f.filter((x) => x !== id) : [...f, id] } };
        }),
      toggleFavoriteSpeaker: (name) =>
        set((s) => {
          const f = s.profile.favoriteSpeakers;
          return { profile: { ...s.profile, favoriteSpeakers: f.includes(name) ? f.filter((x) => x !== name) : [...f, name] } };
        }),
      setBlocks: (blocks) => set({ blocks }),
      removeBlock: (id) => set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) })),
      setOnboarded: (v) => set({ onboarded: v }),

      initDay: (day) => {
        const { plans, profile, blocks } = get();
        const prev = plans[day] ?? emptyPlan();
        const favs = sessions
          .filter((s) => s.day === day && s.kind !== "activity")
          .filter((s) => profile.favoriteSessionIds.includes(s.id) || s.speakers.some((p) => profile.favoriteSpeakers.includes(p.name)))
          .sort((a, b) => Number(profile.favoriteSessionIds.includes(b.id)) - Number(profile.favoriteSessionIds.includes(a.id)) || ms(a.start) - ms(b.start));
        const wanted = new Set(favs.map((s) => s.id));
        let ids = prev.sessionIds.filter((id) => !prev.anchorIds.includes(id) || wanted.has(id));
        const anchors = prev.anchorIds.filter((id) => wanted.has(id));
        // Meetings and must-sees already placed win; a newly starred talk replaces ordinary picks it clashes with.
        const fixed = [...blocks.filter((b) => b.day === day).map(blockSlot), ...anchors.map((id) => sessionSlot(getSession(id)!))];
        for (const s of favs) {
          const slot = sessionSlot(s);
          if (anchors.includes(s.id)) continue;
          if (ids.includes(s.id)) { anchors.push(s.id); fixed.push(slot); continue; }
          if (!fits(fixed, slot)) continue;
          ids = ids.filter((id) => !clashes(sessionSlot(getSession(id)!), slot));
          ids.push(s.id);
          anchors.push(s.id);
          fixed.push(slot);
        }
        const same = plans[day] && ids.length === prev.sessionIds.length && ids.every((id) => prev.sessionIds.includes(id)) && anchors.length === prev.anchorIds.length;
        if (same) return;
        set({ plans: { ...plans, [day]: { ...prev, sessionIds: ids, anchorIds: anchors, done: false } } });
      },

      applyPlans: (next, cursor) =>
        set((s) => {
          const plans = { ...s.plans };
          for (const [d, ids] of Object.entries(next)) {
            const day = Number(d);
            const prev = plans[day] ?? emptyPlan();
            plans[day] = { ...prev, sessionIds: ids, anchorIds: prev.anchorIds.filter((a) => ids.includes(a)) };
          }
          if (cursor) plans[cursor.day] = { ...plans[cursor.day], cursor: cursor.at };
          return { plans };
        }),
      removeSession: (day, id) =>
        set((s) => {
          const p = s.plans[day] ?? emptyPlan();
          return { plans: { ...s.plans, [day]: { ...p, sessionIds: p.sessionIds.filter((x) => x !== id), anchorIds: p.anchorIds.filter((x) => x !== id), done: false } } };
        }),
      setCursor: (day, at) => set((s) => ({ plans: { ...s.plans, [day]: { ...(s.plans[day] ?? emptyPlan()), cursor: at } } })),
      setDone: (day, done) => set((s) => ({ plans: { ...s.plans, [day]: { ...(s.plans[day] ?? emptyPlan()), done } } })),
      resetDay: (day) =>
        set((s) => {
          const plans = { ...s.plans };
          delete plans[day];
          return { plans };
        }),
      setDemoNow: (t) => set({ demoNow: t }),
      setNote: (userId, text) =>
        set((s) => {
          const notes = { ...s.notes };
          if (text) notes[userId] = { text, updatedAt: Date.now() };
          else delete notes[userId];
          return { notes };
        }),
      resetAll: () => set({ profile: newProfile(), blocks: [], plans: {}, onboarded: false, demoNow: null, notes: {} }),
    }),
    {
      name: "kubecon-planner",
      // v2 = real KubeCon schedule: drop any saved session ids that no longer exist.
      version: 2,
      migrate: (persisted) => {
        const s = persisted as State;
        const known = (ids: string[]) => ids.filter((id) => sessions.some((x) => x.id === id));
        const plans = Object.fromEntries(
          Object.entries(s.plans ?? {}).map(([d, p]) => [d, { ...p, sessionIds: known(p.sessionIds), anchorIds: known(p.anchorIds), done: false }]),
        );
        return { ...s, plans, profile: { ...s.profile, favoriteSessionIds: known(s.profile?.favoriteSessionIds ?? []) } };
      },
    },
  ),
);

export const toAttendee = (s: Pick<State, "profile" | "blocks" | "plans">): Attendee => ({ ...s.profile, blocks: s.blocks, plans: s.plans });

/** Plans as plain {day: ids} for the scheduler API. */
export const planIds = (plans: Record<number, DayPlan>): Record<number, string[]> =>
  Object.fromEntries(conference.days.map((d) => [d.day, plans[d.day]?.sessionIds ?? []]));
