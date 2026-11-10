# Conpass

**Your guide to KubeCon + CloudNativeCon NA 2026 (Salt Lake City).** Plan a day that actually works, then walk it: Conpass knows which talks you care about, how long it really takes to walk between rooms, which rooms will fill up, and where the nearest all-gender restroom on your way is.

**Live:** https://conpass.cnh.radarhq.io (built for the Cloud Native Hackathon, Nov 9 2026)

## What it does

| Screen | What you get |
|---|---|
| **Onboarding** (`/onboarding`) | Pick interest areas, search talks and speakers (fuzzy + search-as-you-type), import your own calendar (`.ics` file, iCal URL or demo calendar). |
| **Day builder** (`/plan/[day]`) | Calendar blocks and must-sees are placed first. For each free window you get ranked recommendations with "why" chips, clashes you might like, themed lunch tables, or "leave free". Every suggestion accounts for the **real walking time** from your previous room, room capacity and predicted demand. Export to Google, Outlook or Apple Calendar. |
| **Live** (`/live`) | Now/next and a "leave by" time. **Directions** show the venue floor plan with your route drawn per level, turn-by-turn steps, amenities, a restroom on the way, and walking-speed and accessibility settings. "Room is full" or "I missed it" fills the gap with what you can still reach. |
| **Share / People** (`/share`, `/connect`, `/people`) | QR codes to share your schedule or exchange contact details (only the fields you tick). See talks in common and shared free time, and keep private notes about people you met. |

## Architecture

```
                      https://conpass.cnh.radarhq.io
                                   │
                    Service app:80 (the platform's only route in)
                                   │
                         ┌─────────▼─────────┐
                         │      gateway      │  nginx: /map → maps, everything else → web
                         └────┬─────────┬────┘
                              │         │
                 ┌────────────▼──┐   ┌──▼─────────────────┐
  phones ──RUM──►│      web      │──►│        maps        │
   (Dash0 SDK)   │ Next.js pages │   │ wayfinding API     │
                 │ + /api routes │   │ venue graph,       │
                 └──────┬────────┘   │ Dijkstra, images   │
                        │            └────────────────────┘
                        ▼
          Elasticsearch (Elastic Cloud Serverless)
          sessions · attendees · connections

  web, maps ──OTLP──► Dash0          every push to main ──► GitHub Actions ──► GHCR ──► Argo CD
```

| Service | Path | What it is | Image |
|---|---|---|---|
| `gateway` | `apps/gateway` | nginx with the routing config in a ConfigMap; owns Service `app` | `ghcr.io/absol27/conpass/gateway` |
| `web` | `apps/web` | Next.js 15 (App Router): every screen, plus `/api/*` routes that query Elasticsearch | `ghcr.io/absol27/conpass/web` |
| `maps` | `apps/maps` | Wayfinding API: `/map/api/venue`, `/map/api/route`, `/map/api/walk-matrix`, and floor-plan images | `ghcr.io/absol27/conpass/maps` |
| Elasticsearch | Elastic Cloud | Serverless project, the only datastore | none |

### Architecture choices

- **One monorepo, one service per `apps/<name>/`.** Each app has its own Dockerfile and CI, but a single repo means one Gitar setup, and one PR can change an API and its callers together, which the Gitar API-contract rule checks.
- **GitOps on Radar's cluster.** Merging to `main` builds only the apps that changed, pushes `:<sha>` images to GHCR, and bumps all the tags in **one** bot commit (`deploy: …`). Argo CD deploys that commit. Nobody runs `kubectl apply`.
- **A gateway in front.** The platform gives each team one hostname, routed to Service `app`:80. The gateway keeps one origin for everything: one PWA, no CORS, one QR code.
- **maps is a separate service with a contract.** web never imports routing code. It calls maps over HTTP: the walk-time matrix for the scheduler, and routes and venue geometry for the live map. The UI types in `apps/web/src/components/hallway/types.ts` are that contract.
- **Degrade, don't fail.** If maps is down, the scheduler falls back to zone estimates (with a 30 s retry, so one outage costs at most one 1.5 s timeout). If Elasticsearch is down, search, recommendations and gap fill fall back to local logic. Readiness probes deliberately ignore Elasticsearch.
- **Elastic Cloud Serverless, not in-cluster.** The team budget is 2 CPU / 4 GiB. A self-hosted Elasticsearch would take about a third of the memory, needs a privileged sysctl the host refuses, and couldn't run an embedding model.
- **Secrets never touch git.** The repo and images are public. `elastic` and `dash0` are Kubernetes Secrets created by hand. The GHCR push token lives in a GitHub Environment that only `main` can use.
- **Pure scheduler.** `apps/web/src/lib/scheduler/` is pure functions with unit tests. Elasticsearch ranks candidates; the scheduler decides what fits.

## How we used each sponsor

### Sonar: Gitar (every change went through a reviewed PR)
- **Project-aware setup** in `.gitar/`:
  - `review/` holds our conventions (TypeScript, pure scheduler with tests, Elasticsearch fallbacks, Serverless-safe mappings), the cluster's hard limits (no privileged or hostPath pods, Service `app`:80, quota), and secret handling.
  - `rules/api-contract.md` fails a PR that changes an API's shape without updating its callers.
  - `rules/auto-apply-label.md` turns auto-apply on for every PR.
  - `config/apply.md` lists what Gitar must never auto-fix: deploy tags, generated data, deleting tests, removing fallbacks.
- **Auto-apply fixed real problems on our PRs:**
  - **#2:** corrected the deploy skill's build-trigger docs to match the new workflow.
  - **#5:** flagged that a classic PAT stored as a repo secret could be exfiltrated from any branch, and moved it behind a `main`-only GitHub Environment.
  - **#6:** fixed maps, routing and gateway issues.
  - **#8:** guarded the maps telemetry preload so the service can't crash without Dash0 settings.
- **CI it diagnoses:** `ci-web` and `ci-maps` (typecheck, test, image build) and `ci` (manifests validated with kubeconform, Service `app`:80 check, actionlint, gitleaks).

### Radar: AI SRE (built and operated on our team cluster)
- The app runs on our vcluster `conpass`, deployed through Argo CD. We drove it through Radar's MCP from a coding agent: applying the Argo CD Application, syncing, waiting for rollouts, reading pod health.
- **A real incident, found with Radar:** after the maps PR, the public site went down. Radar showed `gateway` and `maps` stuck in `ImagePullBackOff`. New GHCR packages start private and the cluster pulls anonymously. It also surfaced API-server TLS timeouts that made syncs fail at the same time. Making the packages public brought it back with no redeploy.
- **Radar Checks, before and after:** we captured Checks for our namespace before writing code, then fixed the findings that applied to our workloads: no auto-mounted service-account tokens, 2 replicas for every service, and PodDisruptionBudgets (`deploy/pdb.yaml`).

### Elasticsearch (the core data layer)
- Elastic Cloud Serverless with three indices: `sessions` (503 real KubeCon sessions), `attendees` (profiles, plans and 600 simulated attendees for demand) and `connections`.
- **Recommendations** use one `function_score` query:
  - per-topic interest boosts
  - `more_like_this` on your previous talk
  - followed speakers
  - a `gauss` decay on start time, so shorter gaps rank higher
  - named queries (`_name` → `matched_queries`), which become the "why" chips
- **Search:** fuzzy `multi_match` across title, speakers, keywords and abstract, plus `search_as_you_type` autocomplete and highlighting.
- **Demand:** a `terms` aggregation over every attendee's planned sessions predicts attendance per talk, and flags rooms likely to fill.

### Dash0 (observability built into the product)
- **web:** OpenTelemetry (`@vercel/otel`, `apps/web/src/instrumentation.ts`) traces every page and API request. Elasticsearch query spans come from the ES client, and trace context is propagated into maps, so web → maps is one distributed trace.
- **maps:** OpenTelemetry zero-code Node instrumentation (HTTP traces and metrics), loaded only when Dash0 is configured.
- **Real-user monitoring:** Dash0's Web SDK reports page views, web vitals, errors and fetch timings from attendees' phones. Its config is served at runtime from the cluster Secret, using an ingest-only token.
- **Correlation with Radar:** every span carries `service.namespace`, `k8s.namespace.name`, `k8s.deployment.name` and `k8s.pod.name`, so a slow trace points at the same pod Radar shows.

### Merge Forward: conferences for everyone
- **Step-free routing,** with elevator locations marked verified or unverified.
- **Routing preferences:** avoid escalators, avoid the show floor, fewest level changes.
- **Adjustable walking speed** with presets down to "Mobility aid" (0.8 m/s). Walk times everywhere follow it.
- **Restroom on the way** with an all-gender, women's or men's preference. Amenities on the map include all-gender restrooms, mother's rooms, first aid and info desks.
- **Accessible output:** every route also comes as screen-reader-friendly text, status is never shown by colour alone, and tap targets are at least 44 px.

## Run it locally

Requirements: Node 22, and either Docker or an Elastic Cloud project.

```bash
# web
cd apps/web
cp .env.local.example .env.local   # ES_URL + ES_API_KEY (Elastic Cloud), or keep the local Docker default
docker compose up -d               # optional: local Elasticsearch on :9200
npm install
npm run seed                       # 503 sessions, 600 simulated attendees, demo attendee "Jordan Rivera"
npm run dev                        # http://localhost:3000
npm test

# maps (wayfinding API) in another terminal
cd apps/maps
npm install
npm run build:server && PORT=8081 node server-dist/main.mjs
# then start web with MAPS_URL=http://localhost:8081 for real walk times
```

Without maps, web runs with estimated walk times and the live page shows the map as unavailable.

## Deploy

- **Pipeline:** merging to `main` triggers `.github/workflows/build-deploy.yml`, then Argo CD (see `argocd/application.yaml`) syncs `deploy/`.
- **One-time setup:** create Secrets `elastic` (`url`, `api-key`) and `dash0` (`endpoint`, `auth-token`, `browser-token`) in `team-conpass`, and make each new GHCR package public.
- **For coding agents:** `AGENTS.md` and `.agents/skills/` describe how to ship through Radar's MCP.

## Repo layout

```
apps/web        Next.js app (UI + /api)          apps/maps      wayfinding API + venue data
apps/gateway    nginx image                       deploy/        kustomize manifests (Argo CD)
.github/        CI and build-and-deploy           .gitar/        Gitar review instructions and rules
argocd/         Argo CD Application               .agents/       agent skills for Radar
```

## AI use

We used AI assistants throughout, and every change was reviewed by a team member before merge.

- **Claude Code (Anthropic):** pair-programmed most of the infrastructure:
  - the monorepo layout, Dockerfiles, kustomize manifests, gateway and GitHub Actions workflows
  - the maps HTTP service and its integration into web's live page and scheduler
  - the OpenTelemetry/Dash0 instrumentation
  - this README

  We directed the design, reviewed each diff locally before it was pushed, and tested the stack in Docker before merging.
- **Gitar:** reviewed every PR and pushed fix commits through auto-apply (listed above). Those commits are authored by `gitar-bot`.
- **Radar's AI SRE (via MCP):** used to deploy, check rollouts and diagnose the gateway/maps outage.
- **Dash0 Agent0:** used to investigate the app's performance from its traces.
- The scheduler and UI started from a teammate's prototype built with an AI coding assistant during the hackathon. Its working agreements are in `apps/web/AGENT_BRIEF.md`.

## Team

[@absol27](https://github.com/absol27) · [@anaiainza-ux](https://github.com/anaiainza-ux)
