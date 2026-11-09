// Wayfinding API for apps/web, plus the floor-plan images its map draws.
//   GET /map/api/venue                       venue geometry (levels, nodes, edges, images)
//   GET /map/api/route?from=&to=&settings=   route between two apps/web room ids, plus a restroom on the way
//   GET /map/api/walk-matrix?speed=&stepFree= walking seconds between every pair of rooms
//   GET /map/<image>                         files from public/ (floor plans)
// Bundled with esbuild into server-dist/main.mjs (npm run build:server).
import { createReadStream, statSync } from 'node:fs'
import { createServer, type ServerResponse } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { locationForWebRoom } from '../src/data/roomIds'
import { locations } from '../src/data/saltpalace/locations'
import { saltPalace } from '../src/data/saltpalace/venue'
import { Router } from '../src/routing/router'
import { DEFAULT_SETTINGS, SPEED_MAX, SPEED_MIN, type RouteSettings } from '../src/routing/settings'
import { walkMatrix } from './walkMatrix'

const PORT = Number(process.env.PORT ?? 8080)
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url))
const router = new Router(saltPalace, locations)
const venueJson = JSON.stringify(saltPalace)
const matrices = new Map<string, string>()

const TYPES: Record<string, string> = { '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp' }

function json(res: ServerResponse, status: number, body: unknown, cache = 'no-store') {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': cache })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

const clampSpeed = (v: unknown) => {
  const n = Number(v)
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, Number.isFinite(n) ? n : DEFAULT_SETTINGS.speed))
}

/** Settings from the `settings` query parameter (JSON), defaulted and clamped. */
function parseSettings(raw: string | null): RouteSettings {
  let given: Partial<RouteSettings> = {}
  try {
    if (raw) given = JSON.parse(raw) as Partial<RouteSettings>
  } catch {
    // Fall back to defaults.
  }
  const s: RouteSettings = { ...DEFAULT_SETTINGS }
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof RouteSettings)[]) {
    const v = given[k]
    if (v === undefined || typeof v !== typeof DEFAULT_SETTINGS[k]) continue
    if (typeof v === 'number' && !(Number.isFinite(v) && v >= 0)) continue
    ;(s as unknown as Record<string, unknown>)[k] = v
  }
  if (!['any', 'all-gender', 'women', 'men'].includes(s.restroomPref)) s.restroomPref = DEFAULT_SETTINGS.restroomPref
  s.speed = clampSpeed(s.speed)
  return s
}

function serveRoute(params: URLSearchParams, res: ServerResponse) {
  const from = locationForWebRoom(params.get('from') ?? '')
  const to = locationForWebRoom(params.get('to') ?? '')
  if (!from || !to) return json(res, 200, { result: { kind: 'unknown', location: from ? params.get('to') : params.get('from') }, restroom: null })
  const settings = parseSettings(params.get('settings'))
  json(res, 200, { result: router.route(from, to, settings), restroom: router.restroomDetour(from, to, settings) })
}

function serveMatrix(params: URLSearchParams, res: ServerResponse) {
  // Rounded to 0.1 m/s so the cache stays small.
  const speed = Math.round(clampSpeed(params.get('speed') ?? DEFAULT_SETTINGS.speed) * 10) / 10
  const stepFree = params.get('stepFree') === '1' || params.get('stepFree') === 'true'
  const key = `${speed}|${stepFree}`
  let body = matrices.get(key)
  if (!body) {
    body = JSON.stringify(walkMatrix(router, { ...DEFAULT_SETTINGS, speed, stepFree }))
    matrices.set(key, body)
  }
  json(res, 200, body, 'public, max-age=300')
}

/** Images from public/. Nothing else is served: there is no standalone UI. */
function serveImage(rel: string, res: ServerResponse) {
  const file = normalize(join(PUBLIC, rel))
  const type = TYPES[extname(file)]
  if (!type || !file.startsWith(PUBLIC.endsWith(sep) ? PUBLIC : PUBLIC + sep)) return json(res, 404, { error: 'not found' })
  try {
    if (!statSync(file).isFile()) return json(res, 404, { error: 'not found' })
  } catch {
    return json(res, 404, { error: 'not found' })
  }
  res.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=86400' })
  createReadStream(file).pipe(res)
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  if (path === '/healthz' || path === '/readyz') return json(res, 200, { status: 'ok', version: process.env.APP_VERSION ?? 'dev' })
  if (path === '/map/api/venue') return json(res, 200, venueJson, 'public, max-age=300')
  if (path === '/map/api/route') return serveRoute(url.searchParams, res)
  if (path === '/map/api/walk-matrix') return serveMatrix(url.searchParams, res)
  if (path.startsWith('/map/')) return serveImage(decodeURIComponent(path.slice('/map/'.length)), res)
  json(res, 404, { error: 'not found' })
}).listen(PORT, () => console.log(`maps listening on :${PORT}`))
