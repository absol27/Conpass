# Hallway: KubeCon wayfinding

Sched tells you *what* is on. Hallway tells you **how far apart your talks are**, when to leave,
and how to get there inside the Salt Palace and the attached Hyatt Regency
(KubeCon + CloudNativeCon NA 2026, Nov 9–12).

- **Every hop between talks** gets a walk time, a leave-by time and a status: comfortable,
  tight, won't make it, or overlap ("leave at 3:21, 21 min in, to make the 3:30 start").
- **Routes on the real floor plan**, with level changes pinned, plus turn-by-turn text.
- **Walking speed** defaults to 1.2 m/s (about 2.7 mph). Presets are Brisk 1.4, Relaxed 1.0
  and Mobility aid 0.8, and a slider covers 0.5–1.8.
- **Accessibility** options: step-free (elevators only), avoid escalators, avoid the show floor
  (low-sensory) and fewest level changes. The map shows elevators, escalators, stairs, restrooms
  (all-gender, men's, women's), mother's rooms, first aid and info desks. "Restroom on the way"
  can be limited to all-gender restrooms. There are also larger-text and high-contrast modes.
- **Room distance table**: minutes between the main breakout rooms.
- **Offline PWA**: the schedule, venue graph and floor plan are all precached.

**Schedule data** is scraped from the official KubeCon schedule page for **Wednesday, Nov 11**
(203 sessions). Picking your own talks is out of scope for now. Instead, "My day" is **one talk in
each of Wednesday's 7 time slots**, chosen at random:
- the morning keynote block in Hall DE (12 talks merged into one)
- the six breakout slots: 11:00, 11:50, 14:20, 15:10, 16:10 and 17:00, each with 14–16 talks to
  choose from

"Shuffle talks" re-picks every slot.

## Run

```sh
npm install
npm run dev          # http://localhost:5173 (add --host to open it on your phone)
npm test             # routing + transition unit tests
npm run validate     # venue graph checks (locations mapped, reachability, scale)
npm run build        # static PWA in dist/
```

Data refresh:

```sh
npm run scrape                 # official KubeCon schedule page, Wednesday -> src/data/schedule.json
npm run scrape -- 2026-11-12   # another day
npm run rasterize        # vendor/spcc-brochure-2021.pdf -> public/maps/saltpalace.png (needs poppler)
```

> **`vendor/` is not committed.** The three source PDFs (11 MB) are only needed to regenerate the map images, which are already committed under `public/`. To run `npm run rasterize`, download them into `apps/maps/vendor/` with the file names in the table below: the Salt Palace floor-plan brochure from Visit Salt Lake, the Hyatt Regency Salt Lake City floor plans from Hyatt, and the KubeCon NA 2024 venue map.


## Where the schedule comes from

`scripts/scrape-kubecon.ts` fetches
`events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/`.
That page is rendered by the Linux Foundation's Sessionize WordPress block, which embeds the
whole schedule as JSON (`<script type="application/json" class="sched-data">`). The scraper reads
that JSON rather than the HTML cards. It keeps the title, speakers, times, room, track,
audience level, description and a link back to each session's page. If the page format changes,
it fails loudly.

## How the estimates work

Walk time is the distance along corridors divided by your speed, plus fixed costs for each
level change. All of these numbers can be changed under Settings → "How we estimate":

| Assumption | Default |
|---|---|
| Walking speed | 1.2 m/s |
| Escalator | 30 s per level |
| Stairs | 40 s per level |
| Elevator | 90 s wait + 15 s per level |
| Door to seat | 2 min |

## Venue data

Three sources, each used for what it's good at:

| Source | Used for |
|---|---|
| `vendor/spcc-brochure-2021.pdf`: Salt Palace floor plan (Visit Salt Lake) | Salt Palace corridors and distances. Scale is 0.55 m/unit, from Exhibit Hall A's 48,600 sq ft |
| `vendor/hyatt-regency-slc-floorplans-2023.pdf`: Hyatt's own plans, Levels 2–6 | Hyatt floors, traced to scale from the Regency Ballroom's 23,015 sq ft |
| `vendor/kubecon-na24-venue-map.pdf`: KubeCon NA 2024 venue sign | Where things are: separate elevator, escalator and stairs symbols, all-gender restrooms, info desks, and the Hyatt ↔ Salt Palace access point |

- `src/data/saltpalace/venue.ts` is the Salt Palace graph. It's drawn on the Salt Palace plan, where
  levels 2 and 3 appear as offset insets. Distances are measured within each level, and vertical
  edges join the same physical escalator, elevator or stairs.
- `src/data/saltpalace/hyatt.ts` holds Hyatt Levels 2–5, each drawn as an inset below the Salt
  Palace plan at the same scale. `npm run rasterize` renders the plan images.
- `src/data/saltpalace/locations.ts` maps each official location string to door nodes.

Open `#/editor` to add or move nodes and edges, calibrate the scale, and export JSON. The planner
previews editor drafts until you discard them.

### Known gaps

1. **The Hyatt lobby (Level 1) has no published plan.** The connector location is confirmed by the
   2024 sign. The lobby's escalator, elevator and stairs positions are approximate, which is about
   60 m of the walk.
2. **Two Salt Palace elevators are unverified:** the Halls 4–5 east corridor elevator and the one
   on the Upper Mezzanine above it. The 2024 sign doesn't draw that area. The West Lobby
   escalators are also unconfirmed.
3. **Two Salt Palace corridors are guessed:** the Hall 1 south side and the ballroom's west side.
4. **The exhibit-hall interiors depend on each event's booth layout.**
5. **All three plans are third-party material** (© Salt Palace / Visit Salt Lake, © Hyatt, © LF).
   That's fine for a hackathon demo. A public release needs our own vector map or permission.
