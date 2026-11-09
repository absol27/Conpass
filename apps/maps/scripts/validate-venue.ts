// Sanity checks for the hand-traced venue graph. Exits non-zero on hard failures.
//   npx tsx scripts/validate-venue.ts
import { locations } from '../src/data/saltpalace/locations'
import { saltPalace as venue } from '../src/data/saltpalace/venue'
import { sessions } from '../src/data/schedule'
import { Router } from '../src/routing/router'
import { DEFAULT_SETTINGS } from '../src/routing/settings'
import { fmtDuration } from '../src/plan/time'

let failures = 0
const fail = (msg: string) => {
  failures++
  console.log(`  ✗ ${msg}`)
}
const ok = (msg: string) => console.log(`  ✓ ${msg}`)

console.log('Node/edge integrity')
const ids = new Set<string>()
for (const n of venue.nodes) {
  if (ids.has(n.id)) fail(`duplicate node id ${n.id}`)
  ids.add(n.id)
  if (!venue.levels.some((l) => l.id === n.level)) fail(`node ${n.id} on unknown level ${n.level}`)
}
for (const e of venue.edges) if (!ids.has(e.a) || !ids.has(e.b)) fail(`edge ${e.a}-${e.b} references a missing node`)
ok(`${venue.nodes.length} nodes, ${venue.edges.length} edges`)

console.log('Every schedule location resolves')
const missing = [...new Set(sessions.map((s) => s.location))].filter((l) => !locations[l])
if (missing.length) missing.forEach((l) => fail(`no mapping for "${l}"`))
else ok(`${new Set(sessions.map((s) => s.location)).size} locations mapped`)
for (const [loc, v] of Object.entries(locations)) {
  if ('nodes' in v) for (const id of v.nodes) if (!ids.has(id)) fail(`"${loc}" points at missing node ${id}`)
}

console.log('Reachability')
const router = new Router(venue, locations)
const onsite = router.onsiteLocations()
const hub = 'Salt Palace | Level 1 | Hall DE'
for (const [name, settings] of [
  ['default', DEFAULT_SETTINGS],
  ['step-free', { ...DEFAULT_SETTINGS, stepFree: true }],
] as const) {
  const bad = onsite.filter((l) => router.route(hub, l, settings).kind === 'unreachable')
  if (bad.length) bad.forEach((l) => fail(`${name}: cannot reach "${l}" from Hall DE`))
  else ok(`${name}: all ${onsite.length} locations reachable`)
}

console.log('Scale')
const hallA = 48600 * 0.0929 // m²
const drawnA = 88 * 155 * venue.metersPerUnit ** 2
const ratio = drawnA / hallA
if (ratio < 0.8 || ratio > 1.25) fail(`Hall A drawn area ${drawnA.toFixed(0)} m² vs ${hallA.toFixed(0)} m² (ratio ${ratio.toFixed(2)})`)
else ok(`Hall A drawn area within ${Math.abs(1 - ratio) * 100 < 1 ? '<1' : (Math.abs(1 - ratio) * 100).toFixed(0)}% of 48,600 sq ft`)

// Regency Ballroom: published 23,015 sq ft; traced as 133 x 238 px on Hyatt PDF page 2.
const { hyattPoint } = await import('../src/data/saltpalace/hyatt')
const a = hyattPoint('HY4', 82, 410)
const b = hyattPoint('HY4', 215, 648)
const regency = (b.x - a.x) * (b.y - a.y) * venue.metersPerUnit ** 2
const rRatio = regency / (23015 * 0.0929)
if (rRatio < 0.9 || rRatio > 1.1) fail(`Regency Ballroom drawn area ${regency.toFixed(0)} m² (ratio ${rRatio.toFixed(2)})`)
else ok(`Hyatt Regency Ballroom drawn area within ${(Math.abs(1 - rRatio) * 100).toFixed(0)}% of 23,015 sq ft`)

console.log('Amenities')
const count = (f: (n: (typeof venue.nodes)[number]) => boolean) => venue.nodes.filter(f).length
console.log(`  • elevators ${count((n) => n.kind === 'elevator')} · escalators ${count((n) => n.kind === 'escalator')} · stairs ${count((n) => n.kind === 'stairs')}`)
console.log(`  • restrooms ${count((n) => n.poi === 'restroom')} (all-gender ${count((n) => n.restroom === 'all-gender')}) · info desks ${count((n) => n.poi === 'info')}`)

console.log('Data gaps (expected until verified)')
const unverified = venue.nodes.filter((n) => n.kind === 'elevator' && n.verified === false)
console.log(`  • ${unverified.length} elevator nodes unverified`)
console.log(`  • ${venue.edges.filter((e) => e.approx).length} edges approximate (Hyatt lobby, two guessed Salt Palace corridors)`)

console.log('Sample walks (default settings)')
for (const [a, b] of [
  ['Salt Palace | Level 1 | 151', 'Hyatt Regency | Level 4 | Regency Ballroom B-D'],
  ['Salt Palace | Level 2 | 255 EF', 'Salt Palace | Level 1 | Hall DE'],
  ['Salt Palace | Level 2 | 250 A-C', 'Salt Palace | Level 2 | 255 BC'],
  ['Salt Palace | Level 1 | Grand Ballroom GI', 'Salt Palace | Level 1 | Solutions Showcase | Hall 5 | Cosmic Canyon Zone | Project Pavilion'],
  ['Salt Palace | Level 2 | 255 EF', 'Hyatt Regency | Level 5 | Capitol Reef'],
  ['Hyatt Regency | Level 2 | Salt Lake Ballroom C', 'Hyatt Regency | Level 4 | Regency Ballroom CD'],
]) {
  for (const [name, s] of [['default', DEFAULT_SETTINGS], ['step-free', { ...DEFAULT_SETTINGS, stepFree: true }]] as const) {
    const r = router.route(a, b, s)
    if (r.kind === 'ok')
      console.log(`  ${router.label(a)} → ${router.label(b)} [${name}]: ${Math.round(r.route.meters)} m, ${fmtDuration(r.route.seconds)}${r.route.approx ? ' ≈' : ''}`)
    else console.log(`  ${a} → ${b} [${name}]: ${r.kind}`)
  }
}

if (failures) {
  console.log(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nAll checks passed')
