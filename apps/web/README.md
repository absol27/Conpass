# KubeCon Companion: smart scheduler (Elasticsearch track)

Plan KubeCon NA 2026 (Salt Lake City, Nov 10–12) without clashes, overflowing rooms or forgotten contacts.

## Quick start

```bash
npm install
cp .env.local.example .env.local      # already done locally
docker compose up -d                  # Elasticsearch 9.5 on :9200 (add --profile kibana for Kibana on :5601)
npm run seed                          # indexes the real schedule (503 sessions), 600 simulated attendees, demo attendee "Jordan Rivera"
npm run dev                           # http://localhost:3000
npm test                              # scheduler unit tests
```

**Elastic Cloud:** set `ES_URL` and `ES_API_KEY` in `.env.local`, then run `npm run seed`. No code changes are needed.
**Phones at the demo:** run `npm run dev:lan` and set `NEXT_PUBLIC_BASE_URL=http://<laptop-LAN-IP>:3000` so the QR codes point at your laptop.
**Real schedule data:** `data/sessions.json` is imported from the official KubeCon + CloudNativeCon NA 2026 schedule ([machine-readable mirror](https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule.md), snapshot in `data/kubecon-na-2026-schedule.md`). Run `npm run data:import` to rebuild it, or `npm run data:import -- --fetch` to pull the latest schedule first, then `npm run seed`.
  - It covers Tue–Thu (the main conference). Keynotes are grouped into one block per morning, and registration, co-located events and 1-minute remarks are skipped.
  - Room walking times and capacities in `data/venue.json` are estimates.
  - Themed lunch tables are a Companion feature added during each real lunch break.

## Screens

| Route | What it does |
|---|---|
| `/` | Welcome to Conpass: pick your conference (KubeCon NA 2026 is live; the others are "Coming soon" placeholders) |
| `/kubecon` | Screen 1: what the conference is and its 10 topic areas |
| `/onboarding` | Screen 2: pick interests (+ themed-lunch opt-in) → search talks/speakers (ES fuzzy + autocomplete) → import calendar (.ics upload, iCal URL, demo calendar, manual) |
| `/plan/[day]` | Screen 3: day builder, described below |
| `/live` | Day-of mode: now/next, "leave by", directions + map, *Room is full* / *I missed it* → gap fill. A demo clock lets you time-travel. |
| `/share` | QR codes: **Share schedule** (today or the whole event) and **Exchange contact** (only the fields you tick) |
| `/connect/[token]` | Opens after a scan: talks in common, meet-up windows, themed-lunch match |
| `/people` | Everyone you met, with the talk/activity you were at, plus a LinkedIn button |

## How the scheduler works

All of this lives in `src/lib/scheduler/*`. These are pure functions, unit tested in `tests/scheduler.test.ts`.

1. **Travel model** (`venue.ts`): `walk(zoneA, zoneB) + 2 min per floor + 2 min buffer`.
   - Offsite calendar events add 15 minutes of travel. Video calls add none.
2. **Feasibility** (`feasibility.ts`): A then B is OK when `B.start ≥ A.end + walk`.
   - Arriving up to 5 minutes late is allowed but flagged.
   - Drop-in activities like lunch allow 30 minutes.
3. **Day builder:** the day starts blank, with only your locked calendar meetings and the talks you ★ starred (in the questionnaire, re-synced every time you open the day).
   - The panel on the right shows the talks at the first start time of the day (e.g. 9:00), grouped by start time, with the best match for your interests marked.
   - Pick one and it lands on the timeline in its topic color. The panel moves to when that talk ends (plus the walk) and shows what you can make next.
   - Tap any picked talk to see alternatives for that slot, or any gap to fill it.
4. **Recommendations** (`recommend.ts` → `/api/recommend`): an Elasticsearch `function_score` query.
   - Filters: day and time window.
   - Should clauses:
     - per-topic interest boosts
     - `more_like_this` on your previous talk
     - followed speakers
   - A `gauss` decay on start time ranks smaller gaps higher.
   - Named queries (`_name` → `matched_queries`) give the "why" chips.
   - The app then re-ranks against your real timeline (reachability, lateness, predicted demand).
5. **Going back** (`recommend.ts` + `backtrack.ts`, UI in `plan/[day]`): if a later talk interests you more, you can change past picks to make it fit.
   - Above the next options, small boxes show talks that **start while your last pick is still running** (e.g. a 9:15 talk during your 9:00–9:30 pick).
   - Choose one: your last pick comes off, and the time before the new talk (9:00–9:15) opens up. Fill it, keep it free, or go back another step with the small boxes for the pick before that.
   - Each step replaces exactly one earlier pick. Nothing after the talk you chose changes, and starred talks and calendar meetings are never swapped out.
   - The trail lists every change, with **Undo last change** and **Restore my original plan**. If a swapped-out talk repeats later, the trail offers to add it there.
6. **Demand** (`/api/demand`): a `terms` aggregation over every attendee's schedule ÷ room capacity → "Filling up / Likely full" badges.
7. **Gap fill** (`gapfill.ts` → `/api/live/gapfill`): one ES query finds:
   - talks you can still join (started ≤ 10 minutes ago)
   - talks that fit before you must leave for your next item
   - activities open now (merch, expo, lounge, themed lunch)

   It excludes rooms marked full, then ranks by interest, then walking distance.
8. **Social** (`social.ts`): talks in common, overlapping free time of 15+ minutes (with a meeting spot), finishing in the same wing, and themed-lunch matches. A connection also records what you were attending at the moment you scanned.

If Elasticsearch is unreachable, search, recommendations and gap fill fall back to local logic, so the demo keeps working.

## Demo script (about 4 minutes)

1. `/` → **Open KubeCon** → **Plan my KubeCon**:
   - Tap Security twice and Platform Engineering once.
   - Keep themed lunch on (Security), and enter a name.
2. Search `fabian kamel` (typo on purpose): Elasticsearch fuzzy matching finds **Fabian Kammel**. Follow them, and ★ a talk.
3. Click **Use demo calendar**. This adds a daily 13:00 Zoom standup, a Day 1 offsite dinner at 17:30, and a Day 2 offsite customer coffee. Then **Build my schedule**.
4. **Day 1 (Tue):** the day starts blank except the meetings and your starred talk. Pick the keynote block (9:00); the panel moves to the talks you can make after it.
5. **Going back:**
   1. Pick the 11:00 **Women's Community Gathering**. The small boxes on top show talks starting during it (11:30, 11:40, 11:47).
   2. Choose **New Traffic, New Rules** (11:30). The 11:00 pick comes off and **10:46–11:30** opens up, with the 10:50 and 11:00 talks that fit.
   3. Fill it with the 10:50 **Demo Theater**. The leftover 11:10–11:30 shows its own small boxes for going back one more step.
   4. Use **Undo last change** or **Restore my original plan** to show nothing is lost.
6. Finish the day, choose **Build Wed now**, then **Export** (.ics / Google / webcal).
7. `/live`: set the demo clock to a day and time inside a talk, then click **Room is full**. Suggestions appear: join-late talks, merch and the lounge.
8. `/share` → **Jordan's schedule code**: talks in common, meet-up windows and *"Have lunch together at the Security table"*. Then **Jordan's contact code** → `/people` shows Jordan with "Met during …" and a LinkedIn button.

## Elasticsearch indices

| Index | Purpose |
|---|---|
| `kubecon-sessions` | talks, workshops, keynotes and activities. `title`/`speakers.name` have `search_as_you_type`; english analyzers for MLT. |
| `kubecon-attendees` | profile + plans (`_source`); `scheduleIds` is indexed for the demand aggregation and `shareToken`/`contactToken` for QR lookups |
| `kubecon-connections` | one doc per direction of each scan (owner, other, type, at, context, shared card) |

## Ideas if there's time

- `semantic_text` + ELSER on Elastic Cloud for natural-language search ("help me secure my supply chain")
- Web NFC tap-to-share on Android (QR stays as the fallback)
- Real room occupancy from door counters → `/api/session-status`
